package app.pospro.terminal

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.getcapacitor.BridgeActivity

/**
 * Activity utama shell POS-PRO.
 *
 * - Mendaftarkan plugin PosPrinter (printer Bluetooth native).
 * - Meminta izin runtime yang dibutuhkan seluruh sistem: kamera (selfie
 *   presensi), lokasi (GPS presensi), Bluetooth (printer), notifikasi
 *   (foreground service). getUserMedia/geolocation di WebView baru diizinkan
 *   Capacitor bila izin OS ini sudah GRANTED.
 * - Layar tidak tidur selama terminal aktif.
 * - Tombol back menavigasi di dalam web, tidak menutup app di tengah kerja.
 */
class MainActivity : BridgeActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    registerPlugin(PosPrinterPlugin::class.java)
    super.onCreate(savedInstanceState)

    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    requestStartupPermissions()
  }

  private fun requestStartupPermissions() {
    val wanted = mutableListOf(
      Manifest.permission.CAMERA,
      Manifest.permission.ACCESS_FINE_LOCATION,
      Manifest.permission.ACCESS_COARSE_LOCATION,
    )
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      wanted += Manifest.permission.BLUETOOTH_CONNECT
      wanted += Manifest.permission.BLUETOOTH_SCAN
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      wanted += Manifest.permission.POST_NOTIFICATIONS
    }
    val missing = wanted.filter {
      ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
    }
    if (missing.isNotEmpty()) {
      ActivityCompat.requestPermissions(this, missing.toTypedArray(), 9001)
    }
  }

  override fun onBackPressed() {
    val webView = bridge?.webView
    if (webView != null && webView.canGoBack()) {
      webView.goBack()
    } else {
      super.onBackPressed() // di root → perilaku default (mis. minimize)
    }
  }
}
