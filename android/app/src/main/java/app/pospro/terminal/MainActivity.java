package app.pospro.terminal;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;

import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

import java.util.ArrayList;
import java.util.List;

/**
 * Activity utama shell POS-PRO.
 *
 * - Mendaftarkan plugin PosPrinter (printer Bluetooth native).
 * - Meminta izin runtime seluruh sistem: kamera (selfie presensi), lokasi (GPS
 *   presensi), Bluetooth (printer), notifikasi (foreground service).
 *   getUserMedia/geolocation di WebView baru diizinkan bila izin OS ini GRANTED.
 * - Layar tidak tidur selama terminal aktif.
 *
 * Tombol back memakai perilaku bawaan Capacitor (navigasi web bila bisa).
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(@Nullable Bundle savedInstanceState) {
        registerPlugin(PosPrinterPlugin.class);
        super.onCreate(savedInstanceState);

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        requestStartupPermissions();
    }

    private void requestStartupPermissions() {
        List<String> wanted = new ArrayList<>();
        wanted.add(Manifest.permission.CAMERA);
        wanted.add(Manifest.permission.ACCESS_FINE_LOCATION);
        wanted.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            wanted.add(Manifest.permission.BLUETOOTH_CONNECT);
            wanted.add(Manifest.permission.BLUETOOTH_SCAN);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            wanted.add(Manifest.permission.POST_NOTIFICATIONS);
        }

        List<String> missing = new ArrayList<>();
        for (String p : wanted) {
            if (ContextCompat.checkSelfPermission(this, p) != PackageManager.PERMISSION_GRANTED) {
                missing.add(p);
            }
        }
        if (!missing.isEmpty()) {
            ActivityCompat.requestPermissions(this, missing.toArray(new String[0]), 9001);
        }
    }
}
