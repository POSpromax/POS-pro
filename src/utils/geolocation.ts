export interface GeoPositionSample {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: number;
}

interface AcquireGeoPositionOptions {
  targetAccuracyMeters: number;
  timeoutMs?: number;
  onSample?: (sample: GeoPositionSample, sampleCount: number) => void;
}

const toRadians = (value: number) => (value * Math.PI) / 180;

export const geoDistanceMeters = (
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
) => {
  const dLatitude = toRadians(latitudeB - latitudeA);
  const dLongitude = toRadians(longitudeB - longitudeA);
  const a = Math.sin(dLatitude / 2) ** 2
    + Math.cos(toRadians(latitudeA))
      * Math.cos(toRadians(latitudeB))
      * Math.sin(dLongitude / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const geolocationErrorMessage = (error: GeolocationPositionError) => {
  if (error.code === error.PERMISSION_DENIED) {
    return 'Izin lokasi ditolak. Aktifkan izin lokasi presisi untuk aplikasi/browser ini.';
  }
  if (error.code === error.TIMEOUT) {
    return 'Sinyal GPS belum stabil. Dekat jendela atau pintu, lalu coba lagi.';
  }
  return 'Lokasi perangkat belum tersedia. Pastikan GPS aktif dan mode hemat baterai dimatikan.';
};

/**
 * Browser sering mengirim pembacaan Wi-Fi yang kasar lebih dulu, kemudian GPS
 * yang lebih presisi beberapa detik kemudian. Ambil beberapa sampel dan pilih
 * akurasi terbaik; berhenti lebih awal saat target kebijakan outlet tercapai.
 */
export const acquireBestGeoPosition = ({
  targetAccuracyMeters,
  timeoutMs = 15_000,
  onSample,
}: AcquireGeoPositionOptions): Promise<GeoPositionSample> => new Promise((resolve, reject) => {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    reject(new Error('Perangkat ini tidak mendukung layanan lokasi.'));
    return;
  }

  const target = Math.max(5, Number(targetAccuracyMeters) || 80);
  let best: GeoPositionSample | null = null;
  let sampleCount = 0;
  let watchId: number | null = null;
  let settled = false;

  const cleanup = () => {
    window.clearTimeout(timerId);
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  };
  const finish = (sample: GeoPositionSample) => {
    if (settled) return;
    settled = true;
    cleanup();
    resolve(sample);
  };
  const fail = (error: Error) => {
    if (settled) return;
    settled = true;
    cleanup();
    reject(error);
  };

  const timerId = window.setTimeout(() => {
    if (best) finish(best);
    else fail(new Error('GPS tidak memberikan titik lokasi dalam batas waktu.'));
  }, timeoutMs);

  try {
    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const sample: GeoPositionSample = {
          latitude: Number(position.coords.latitude),
          longitude: Number(position.coords.longitude),
          accuracy: Number(position.coords.accuracy),
          capturedAt: Number(position.timestamp) || Date.now(),
        };
        if (
          !Number.isFinite(sample.latitude)
          || !Number.isFinite(sample.longitude)
          || !Number.isFinite(sample.accuracy)
          || sample.accuracy <= 0
        ) return;

        sampleCount += 1;
        if (!best || sample.accuracy < best.accuracy) best = sample;
        onSample?.(best, sampleCount);
        if (best.accuracy <= target) finish(best);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          fail(new Error(geolocationErrorMessage(error)));
          return;
        }
        // POSITION_UNAVAILABLE/TIMEOUT sementara tidak membatalkan sampel baik
        // yang sudah didapat. Timer memberi sensor kesempatan memperbaiki titik.
        if (!best && timeoutMs <= 1_000) fail(new Error(geolocationErrorMessage(error)));
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  } catch (error) {
    fail(error instanceof Error ? error : new Error('GPS gagal diaktifkan.'));
  }
});
