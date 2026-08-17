package app.pospro.terminal

import android.Manifest
import android.app.AlertDialog
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.content.Intent
import android.os.Build
import android.util.Base64
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.io.OutputStream
import java.util.UUID

/**
 * Bridge printer Bluetooth Classic/SPP untuk POS-PRO.
 *
 * Mengekspos kontrak yang dibaca src/services/androidPrinterBridge.ts sebagai
 * plugin Capacitor bernama "PosPrinter" (window.Capacitor.Plugins.PosPrinter).
 *
 * Koneksi disimpan di companion object (bertahan selama proses hidup) dan
 * PrinterForegroundService menjaga proses tidak dibunuh saat aplikasi di
 * background — inilah yang membuat printer tetap tersambung saat kasir pindah
 * ke ShopeeFood/Grab, berbeda dengan Web BLE.
 */
@CapacitorPlugin(
  name = "PosPrinter",
  permissions = [
    Permission(
      alias = "bluetooth",
      strings = [
        Manifest.permission.BLUETOOTH_CONNECT,
        Manifest.permission.BLUETOOTH_SCAN,
      ],
    ),
  ],
)
class PosPrinterPlugin : Plugin() {

  companion object {
    private val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    private var socket: BluetoothSocket? = null
    private var out: OutputStream? = null
    @Volatile private var deviceAddress: String? = null
    @Volatile private var deviceName: String? = null

    fun isLive(): Boolean = socket?.isConnected == true
  }

  private val adapter: BluetoothAdapter? get() = BluetoothAdapter.getDefaultAdapter()

  private fun needsRuntimeBtPermission(): Boolean = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S

  private fun hasBtPermission(): Boolean =
    getPermissionState("bluetooth") == com.getcapacitor.PermissionState.GRANTED

  // ── Kontrak ────────────────────────────────────────────────────────────────

  @PluginMethod
  fun isSupported(call: PluginCall) {
    call.resolve(JSObject().put("supported", adapter != null))
  }

  @PluginMethod
  fun isConnected(call: PluginCall) {
    call.resolve(JSObject().put("connected", isLive()))
  }

  @PluginMethod
  fun selectAndConnect(call: PluginCall) {
    if (adapter == null) return reject(call, "Perangkat tidak punya Bluetooth")
    if (adapter?.isEnabled != true) return reject(call, "Nyalakan Bluetooth terlebih dulu")
    if (needsRuntimeBtPermission() && !hasBtPermission()) {
      requestPermissionForAlias("bluetooth", call, "afterBtPermission")
      return
    }
    showPickerAndConnect(call)
  }

  @PermissionCallback
  fun afterBtPermission(call: PluginCall) {
    if (!hasBtPermission()) return reject(call, "Izin Bluetooth ditolak")
    showPickerAndConnect(call)
  }

  @PluginMethod
  fun reconnect(call: PluginCall) {
    val addr = call.getString("address") ?: deviceAddress
    if (addr == null) return call.resolve(JSObject().put("connected", false))
    if (needsRuntimeBtPermission() && !hasBtPermission()) {
      return call.resolve(JSObject().put("connected", false))
    }
    val device = try { adapter?.getRemoteDevice(addr) } catch (e: Exception) { null }
      ?: return call.resolve(JSObject().put("connected", false))
    Thread {
      val ok = connectTo(device)
      call.resolve(JSObject().put("connected", ok))
    }.start()
  }

  @PluginMethod
  fun printBase64(call: PluginCall) {
    val data = call.getString("data")
      ?: return call.resolve(err("data kosong"))
    Thread {
      val stream = out
      if (stream == null || socket?.isConnected != true) {
        call.resolve(err("printer belum terhubung")); return@Thread
      }
      try {
        val bytes = Base64.decode(data, Base64.DEFAULT)
        var i = 0
        while (i < bytes.size) {
          val end = minOf(i + 256, bytes.size)
          stream.write(bytes, i, end - i)
          stream.flush()
          i = end
          Thread.sleep(8)
        }
        call.resolve(JSObject().put("success", true))
      } catch (e: Exception) {
        // Anggap koneksi putus; tutup agar reconnect berikutnya bersih.
        closeQuietly()
        call.resolve(err(e.message ?: "gagal mengirim ke printer"))
      }
    }.start()
  }

  @PluginMethod
  fun disconnect(call: PluginCall) {
    closeQuietly()
    stopKeepAlive()
    call.resolve()
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  private fun showPickerAndConnect(call: PluginCall) {
    val bonded = try { adapter?.bondedDevices?.toList() } catch (e: Exception) { null }.orEmpty()
    if (bonded.isEmpty()) {
      return reject(call, "Belum ada printer yang dipasangkan. Pair dulu di Pengaturan Bluetooth Android.")
    }
    activity.runOnUiThread {
      val names = bonded.map { safeName(it) }.toTypedArray()
      AlertDialog.Builder(activity)
        .setTitle("Pilih Printer")
        .setItems(names) { _, which ->
          val device = bonded[which]
          Thread {
            val ok = connectTo(device)
            if (ok) {
              call.resolve(
                JSObject()
                  .put("success", true)
                  .put("connected", true)
                  .put("name", safeName(device))
                  .put("address", device.address),
              )
            } else {
              call.resolve(err("Gagal menyambung ke ${safeName(device)}"))
            }
          }.start()
        }
        .setNegativeButton("Batal") { _, _ -> reject(call, "Dibatalkan") }
        .setCancelable(true)
        .show()
    }
  }

  /** Buka socket RFCOMM/SPP di thread pemanggil (bukan main thread). */
  private fun connectTo(device: BluetoothDevice): Boolean {
    closeQuietly()
    try {
      adapter?.cancelDiscovery()
      val s = device.createRfcommSocketToServiceRecord(SPP_UUID)
      s.connect()
      socket = s
      out = s.outputStream
      deviceAddress = device.address
      deviceName = safeName(device)
      startKeepAlive()
      return true
    } catch (first: Exception) {
      // Fallback refleksi untuk printer yang rewel dengan UUID standar.
      try {
        val m = device.javaClass.getMethod("createRfcommSocket", Int::class.javaPrimitiveType)
        val s = m.invoke(device, 1) as BluetoothSocket
        s.connect()
        socket = s
        out = s.outputStream
        deviceAddress = device.address
        deviceName = safeName(device)
        startKeepAlive()
        return true
      } catch (second: Exception) {
        closeQuietly()
        return false
      }
    }
  }

  private fun safeName(device: BluetoothDevice): String =
    try { device.name ?: device.address } catch (e: SecurityException) { device.address }

  private fun closeQuietly() {
    try { out?.close() } catch (_: Exception) {}
    try { socket?.close() } catch (_: Exception) {}
    out = null
    socket = null
  }

  private fun startKeepAlive() {
    val intent = Intent(context, PrinterForegroundService::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent)
    else context.startService(intent)
  }

  private fun stopKeepAlive() {
    context.stopService(Intent(context, PrinterForegroundService::class.java))
  }

  private fun err(message: String): JSObject =
    JSObject().put("success", false).put("error", message)

  private fun reject(call: PluginCall, message: String) {
    call.resolve(JSObject().put("success", false).put("connected", false).put("error", message))
  }
}
