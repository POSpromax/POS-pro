package app.pospro.terminal;

import android.Manifest;
import android.app.AlertDialog;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Intent;
import android.os.Build;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.OutputStream;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Bridge printer Bluetooth Classic/SPP untuk POS-PRO.
 *
 * Mengekspos kontrak yang dibaca src/services/androidPrinterBridge.ts sebagai
 * plugin Capacitor "PosPrinter" (window.Capacitor.Plugins.PosPrinter).
 *
 * Socket disimpan statis (bertahan selama proses hidup) dan
 * PrinterForegroundService menjaga proses tidak dibunuh OS saat aplikasi di
 * background — inilah yang membuat printer tetap tersambung saat kasir pindah
 * ke ShopeeFood/Grab, berbeda dengan Web BLE.
 */
@CapacitorPlugin(
    name = "PosPrinter",
    permissions = {
        @Permission(alias = "bluetooth", strings = {
            Manifest.permission.BLUETOOTH_CONNECT,
            Manifest.permission.BLUETOOTH_SCAN
        })
    }
)
public class PosPrinterPlugin extends Plugin {

    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private static BluetoothSocket socket;
    private static OutputStream out;
    private static volatile String deviceAddress;

    private static boolean isLive() {
        return socket != null && socket.isConnected();
    }

    private BluetoothAdapter adapter() {
        return BluetoothAdapter.getDefaultAdapter();
    }

    private boolean needsRuntimeBt() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S;
    }

    private boolean hasBt() {
        return getPermissionState("bluetooth") == PermissionState.GRANTED;
    }

    // ── Kontrak ─────────────────────────────────────────────────────────────

    @PluginMethod
    public void isSupported(PluginCall call) {
        call.resolve(new JSObject().put("supported", adapter() != null));
    }

    @PluginMethod
    public void isConnected(PluginCall call) {
        call.resolve(new JSObject().put("connected", isLive()));
    }

    @PluginMethod
    public void selectAndConnect(PluginCall call) {
        BluetoothAdapter a = adapter();
        if (a == null) { reject(call, "Perangkat tidak punya Bluetooth"); return; }
        if (!a.isEnabled()) { reject(call, "Nyalakan Bluetooth terlebih dulu"); return; }
        if (needsRuntimeBt() && !hasBt()) {
            requestPermissionForAlias("bluetooth", call, "afterBtPermission");
            return;
        }
        showPickerAndConnect(call);
    }

    @PermissionCallback
    private void afterBtPermission(PluginCall call) {
        if (!hasBt()) { reject(call, "Izin Bluetooth ditolak"); return; }
        showPickerAndConnect(call);
    }

    @PluginMethod
    public void reconnect(PluginCall call) {
        String addr = call.getString("address", deviceAddress);
        if (addr == null) { call.resolve(new JSObject().put("connected", false)); return; }
        if (needsRuntimeBt() && !hasBt()) { call.resolve(new JSObject().put("connected", false)); return; }
        final String fAddr = addr;
        new Thread(() -> {
            BluetoothDevice device = null;
            try { device = adapter().getRemoteDevice(fAddr); } catch (Exception ignored) {}
            boolean ok = device != null && connectTo(device);
            call.resolve(new JSObject().put("connected", ok));
        }).start();
    }

    @PluginMethod
    public void printBase64(PluginCall call) {
        final String data = call.getString("data");
        if (data == null) { call.resolve(err("data kosong")); return; }
        new Thread(() -> {
            OutputStream stream = out;
            if (stream == null || socket == null || !socket.isConnected()) {
                call.resolve(err("printer belum terhubung"));
                return;
            }
            try {
                byte[] bytes = Base64.decode(data, Base64.DEFAULT);
                int i = 0;
                while (i < bytes.length) {
                    int end = Math.min(i + 256, bytes.length);
                    stream.write(bytes, i, end - i);
                    stream.flush();
                    i = end;
                    Thread.sleep(8);
                }
                call.resolve(new JSObject().put("success", true));
            } catch (Exception e) {
                closeQuietly();
                call.resolve(err(e.getMessage() != null ? e.getMessage() : "gagal mengirim ke printer"));
            }
        }).start();
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        closeQuietly();
        stopKeepAlive();
        call.resolve();
    }

    // ── Internal ────────────────────────────────────────────────────────────

    private void showPickerAndConnect(PluginCall call) {
        final List<BluetoothDevice> devices;
        try {
            devices = new ArrayList<>(adapter().getBondedDevices());
        } catch (Exception e) {
            reject(call, "Tidak bisa membaca perangkat paired");
            return;
        }
        if (devices.isEmpty()) {
            reject(call, "Belum ada printer yang dipasangkan. Pair dulu di Pengaturan Bluetooth Android.");
            return;
        }
        getActivity().runOnUiThread(() -> {
            String[] names = new String[devices.size()];
            for (int i = 0; i < devices.size(); i++) names[i] = safeName(devices.get(i));
            new AlertDialog.Builder(getActivity())
                .setTitle("Pilih Printer")
                .setItems(names, (dialog, which) -> {
                    final BluetoothDevice device = devices.get(which);
                    new Thread(() -> {
                        boolean ok = connectTo(device);
                        if (ok) {
                            call.resolve(new JSObject()
                                .put("success", true).put("connected", true)
                                .put("name", safeName(device)).put("address", device.getAddress()));
                        } else {
                            call.resolve(err("Gagal menyambung ke " + safeName(device)));
                        }
                    }).start();
                })
                .setNegativeButton("Batal", (dialog, which) -> reject(call, "Dibatalkan"))
                .setCancelable(true)
                .show();
        });
    }

    /** Buka socket RFCOMM/SPP di thread pemanggil (bukan main thread). */
    private boolean connectTo(BluetoothDevice device) {
        closeQuietly();
        try {
            adapter().cancelDiscovery();
            BluetoothSocket s = device.createRfcommSocketToServiceRecord(SPP_UUID);
            s.connect();
            socket = s;
            out = s.getOutputStream();
            deviceAddress = device.getAddress();
            startKeepAlive();
            return true;
        } catch (Exception first) {
            // Fallback refleksi untuk printer yang rewel dengan UUID standar.
            try {
                Method m = device.getClass().getMethod("createRfcommSocket", int.class);
                BluetoothSocket s = (BluetoothSocket) m.invoke(device, 1);
                s.connect();
                socket = s;
                out = s.getOutputStream();
                deviceAddress = device.getAddress();
                startKeepAlive();
                return true;
            } catch (Exception second) {
                closeQuietly();
                return false;
            }
        }
    }

    private String safeName(BluetoothDevice device) {
        try {
            String n = device.getName();
            return n != null ? n : device.getAddress();
        } catch (SecurityException e) {
            return device.getAddress();
        }
    }

    private void closeQuietly() {
        try { if (out != null) out.close(); } catch (Exception ignored) {}
        try { if (socket != null) socket.close(); } catch (Exception ignored) {}
        out = null;
        socket = null;
    }

    private void startKeepAlive() {
        Intent intent = new Intent(getContext(), PrinterForegroundService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) getContext().startForegroundService(intent);
        else getContext().startService(intent);
    }

    private void stopKeepAlive() {
        getContext().stopService(new Intent(getContext(), PrinterForegroundService.class));
    }

    private JSObject err(String message) {
        return new JSObject().put("success", false).put("error", message);
    }

    private void reject(PluginCall call, String message) {
        call.resolve(new JSObject().put("success", false).put("connected", false).put("error", message));
    }
}
