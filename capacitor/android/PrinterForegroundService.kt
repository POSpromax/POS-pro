package app.pospro.terminal

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/**
 * Foreground service tipis: tidak memegang socket sendiri (socket disimpan di
 * PosPrinterPlugin companion object), tugasnya hanya MENJAGA PROSES tetap hidup
 * saat aplikasi di-background sehingga socket printer tidak ikut dibunuh OS.
 *
 * Inilah kunci "printer tetap tersambung saat pindah aplikasi".
 */
class PrinterForegroundService : Service() {

  companion object {
    private const val CHANNEL_ID = "pospro_printer"
    private const val NOTIF_ID = 4711
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    startInForeground()
    // START_STICKY: bila proses sempat dibunuh, sistem coba jalankan lagi.
    return START_STICKY
  }

  private fun startInForeground() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val mgr = getSystemService(NotificationManager::class.java)
      if (mgr.getNotificationChannel(CHANNEL_ID) == null) {
        mgr.createNotificationChannel(
          NotificationChannel(CHANNEL_ID, "Printer POS-PRO", NotificationManager.IMPORTANCE_LOW),
        )
      }
    }
    val notification: Notification = androidx.core.app.NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("POS-PRO")
      .setContentText("Printer siap")
      .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
      .setOngoing(true)
      .build()

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE)
    } else {
      startForeground(NOTIF_ID, notification)
    }
  }
}
