package app.pospro.terminal;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

/**
 * Foreground service tipis: tidak memegang socket sendiri (socket disimpan statis
 * di PosPrinterPlugin), tugasnya hanya MENJAGA PROSES tetap hidup saat aplikasi
 * di-background sehingga socket printer tidak ikut dibunuh OS.
 *
 * Inilah kunci "printer tetap tersambung saat pindah aplikasi".
 */
public class PrinterForegroundService extends Service {

    private static final String CHANNEL_ID = "pospro_printer";
    private static final int NOTIF_ID = 4711;

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startInForeground();
        return START_STICKY;
    }

    private void startInForeground() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager mgr = getSystemService(NotificationManager.class);
            if (mgr != null && mgr.getNotificationChannel(CHANNEL_ID) == null) {
                mgr.createNotificationChannel(new NotificationChannel(
                    CHANNEL_ID, "Printer POS-PRO", NotificationManager.IMPORTANCE_LOW));
            }
        }
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("POS-PRO")
            .setContentText("Printer siap")
            .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
            .setOngoing(true)
            .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE);
        } else {
            startForeground(NOTIF_ID, notification);
        }
    }
}
