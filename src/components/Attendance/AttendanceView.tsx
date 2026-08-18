import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Camera, MapPin, UserCheck, Delete, CheckCircle2, Clock, Video, ShieldCheck } from 'lucide-react';
import { AttendanceRecord, Branch, RestaurantProfile, UserAccount } from '../../types/pos';
import { cloudReadiness } from '../../lib/runtimeEnv';
import { uploadImage } from '../../services/cloudinaryMedia';
import { DBStorage } from '../../services/dbStorage';
import { AttendanceHrPanel } from './AttendanceHrPanel';

interface AttendanceViewProps {
  attendanceRecords: AttendanceRecord[];
  onSaveAttendance: (record: AttendanceRecord) => void | Promise<void>;
  activeUser: UserAccount;
  staffAccounts: UserAccount[];
  profile: RestaurantProfile;
  currentBranch: Branch;
  terminalMode?: boolean;
  configReady?: boolean;
  onShowToast: (title: string, message: string) => void;
}

type AttendanceStep = 'PIN' | 'SELFIE_GPS' | 'SUCCESS';

const WEEK_DAYS = [
  { day: 1, short: 'Sen', label: 'Senin' },
  { day: 2, short: 'Sel', label: 'Selasa' },
  { day: 3, short: 'Rab', label: 'Rabu' },
  { day: 4, short: 'Kam', label: 'Kamis' },
  { day: 5, short: 'Jum', label: 'Jumat' },
  { day: 6, short: 'Sab', label: 'Sabtu' },
  { day: 0, short: 'Min', label: 'Minggu' },
] as const;

const effectiveWorkDays = (staff: UserAccount, profile: RestaurantProfile): number[] => {
  if (Array.isArray(staff.workDays) && staff.workDays.length > 0) {
    return [...new Set(staff.workDays)].filter((day) => day >= 0 && day <= 6);
  }
  const offDays = new Set((profile.weeklyOffDays || []).filter((day) => day >= 0 && day <= 6));
  return WEEK_DAYS.map((day) => day.day).filter((day) => !offDays.has(day));
};

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  attendanceRecords,
  onSaveAttendance,
  activeUser,
  staffAccounts,
  profile,
  currentBranch,
  terminalMode = false,
  configReady = true,
  onShowToast,
}) => {
  const eligibleStaff = useMemo(
    () => staffAccounts.filter(
      (staff) => staff.isActive !== false && staff.role !== 'OWNER' && staff.role !== 'SUPER_OWNER' && (!staff.branchIds?.length || staff.branchIds.includes(currentBranch.id)),
    ),
    [staffAccounts, currentBranch.id],
  );
  const ownerManagementOnly = !terminalMode && (activeUser.role === 'OWNER' || activeUser.role === 'SUPER_OWNER');

  const [step, setStep] = useState<AttendanceStep>(terminalMode || cloudReadiness.supabase ? 'SELFIE_GPS' : 'PIN');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<UserAccount>(
    terminalMode
      ? (eligibleStaff.find((s) => s.id === activeUser.id) || activeUser)
      : cloudReadiness.supabase ? activeUser : eligibleStaff[0] || activeUser,
  );

  const [selfiePreview, setSelfiePreview] = useState('');
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [gpsMessage, setGpsMessage] = useState('GPS belum diverifikasi');
  const [uploadMessage, setUploadMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gpsPosition, setGpsPosition] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [isGpsValid, setIsGpsValid] = useState(!profile.requireGpsActive);

  // Jam berjalan (live) + ringkasan presensi terakhir untuk layar sukses.
  const [nowTs, setNowTs] = useState(() => new Date());
  const [lastSaved, setLastSaved] = useState<AttendanceRecord | null>(null);
  const [successWorkMinutes, setSuccessWorkMinutes] = useState<number | null>(null);
  useEffect(() => {
    const timer = window.setInterval(() => setNowTs(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Live WebCam Streaming States & Refs
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const permissionRequestKeyRef = useRef('');

  const stopCameraStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
    setIsCameraReady(false);
  }, []);

  const startCameraStream = useCallback(async () => {
    setCameraError('');
    try {
      stopCameraStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
      mediaStreamRef.current = stream;
      setIsCameraActive(true);
    } catch (err) {
      console.warn('Gagal membuka kamera langsung:', err);
      setCameraError('Kamera tidak diizinkan atau tidak ditemukan pada perangkat ini.');
      setIsCameraActive(false);
    }
  }, [stopCameraStream]);

  useEffect(() => {
    const video = videoRef.current;
    const stream = mediaStreamRef.current;
    if (!isCameraActive || !video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => {
      setCameraError('Preview kamera belum dapat diputar. Tekan coba ulang kamera.');
    });
  }, [isCameraActive]);

  const captureLiveSnapshot = useCallback(() => {
    if (!videoRef.current || !isCameraReady || videoRef.current.videoWidth === 0) {
      setCameraError('Kamera belum siap. Tunggu sampai preview terlihat lalu coba lagi.');
      return;
    }
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Mirror image for natural selfie feel
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setSelfiePreview(dataUrl);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `selfie-${Date.now()}.jpg`, { type: 'image/jpeg' });
          setSelfieFile(file);
        }
      },
      'image/jpeg',
      0.85
    );

    stopCameraStream();
  }, [isCameraReady, stopCameraStream]);

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [stopCameraStream]);

  useEffect(() => {
    setStep(terminalMode || cloudReadiness.supabase ? 'SELFIE_GPS' : 'PIN');
    setPinInput('');
    setPinError('');
    setSelfiePreview('');
    setSelfieFile(null);
    setGpsMessage('GPS belum diverifikasi');
    setIsGpsValid(!profile.requireGpsActive);
    setUploadMessage('');
    stopCameraStream();

    if (terminalMode || cloudReadiness.supabase) {
      setSelectedStaff(eligibleStaff.find((s) => s.id === activeUser.id) || activeUser);
    }
  }, [currentBranch.id, activeUser.id, terminalMode, eligibleStaff, stopCameraStream]);

  const todayRecords = useMemo(() => {
    const today = new Date().toDateString();
    return attendanceRecords
      .filter((record) => record.staffId === selectedStaff.id && new Date(record.timestamp).toDateString() === today)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [attendanceRecords, selectedStaff.id]);

  const lastAttendance = todayRecords[todayRecords.length - 1];
  const clockType: 'CLOCK_IN' | 'CLOCK_OUT' = lastAttendance?.type === 'CLOCK_IN' ? 'CLOCK_OUT' : 'CLOCK_IN';
  const hasEligibleIdentity = terminalMode ? activeUser.isActive !== false : eligibleStaff.length > 0;

  const getScheduledStart = () => {
    if (selectedStaff.shiftStart) return selectedStaff.shiftStart;
    if (selectedStaff.role === 'KITCHEN') return profile.shiftScheduleKitchen || '07:00';
    if (selectedStaff.role === 'KASIR') return profile.shiftScheduleCashier || '08:00';
    if (selectedStaff.role === 'ADMIN' || selectedStaff.role === 'MANAGER') return profile.shiftScheduleAdmin || '08:00';
    return profile.shiftScheduleStaff || '09:00';
  };

  const verifyGps = async (): Promise<boolean> => {
    if (!profile.requireGpsActive) {
      setIsGpsValid(true);
      return true;
    }
    // `profile` already contains the effective branch override loaded from
    // Supabase. Branch columns win when a deployment stores GPS there.
    const outletLatitude = currentBranch.gpsLatitude ?? profile.gpsLatitude;
    const outletLongitude = currentBranch.gpsLongitude ?? profile.gpsLongitude;
    const outletRadius = currentBranch.gpsRadiusMeters ?? profile.gpsRadiusMeters ?? 50;
    if (!navigator.geolocation || outletLatitude === undefined || outletLongitude === undefined) {
      setGpsMessage('Konfigurasi GPS outlet belum lengkap');
      setIsGpsValid(false);
      return false;
    }
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const toRad = (v: number) => (v * Math.PI) / 180;
          const R = 6_371_000;
          const dLat = toRad(position.coords.latitude - outletLatitude);
          const dLng = toRad(position.coords.longitude - outletLongitude);
          const lat1 = toRad(outletLatitude);
          const lat2 = toRad(position.coords.latitude);
          const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
          const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const maxAccuracy = Math.max(5, Number(profile.maxGpsAccuracyMeters || 80));
          const accuracyOk = Number.isFinite(position.coords.accuracy) && position.coords.accuracy <= maxAccuracy;
          const insideRadius = distance <= outletRadius;
          const allowed = insideRadius && accuracyOk;
          setGpsPosition({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
          setGpsMessage(
            !accuracyOk
              ? `Akurasi GPS ±${Math.round(position.coords.accuracy)} m — tunggu hingga ≤ ${Math.round(maxAccuracy)} m`
              : insideRadius
                ? `GPS valid · ${Math.round(distance)} m dari outlet · akurasi ±${Math.round(position.coords.accuracy)} m`
                : `Di luar radius · ${Math.round(distance)} m dari outlet`,
          );
          setIsGpsValid(allowed);
          resolve(allowed);
        },
        () => {
          setGpsMessage('Izin GPS diperlukan untuk absensi');
          setIsGpsValid(false);
          resolve(false);
        },
        { enableHighAccuracy: true, timeout: 10_000 },
      );
    });
  };

  useEffect(() => {
    // Mode owner (hanya memantau dashboard presensi) TIDAK boleh menyalakan
    // kamera/GPS — owner tidak melakukan clock in/out. Bila sempat aktif, matikan.
    if (ownerManagementOnly) {
      stopCameraStream();
      return;
    }
    if (step !== 'SELFIE_GPS' || profile.isAttendanceEnabled === false) return;
    const requestKey = `${currentBranch.id}:${selectedStaff.id}`;
    if (permissionRequestKeyRef.current === requestKey) return;
    permissionRequestKeyRef.current = requestKey;
    setGpsMessage(profile.requireGpsActive ? 'Meminta izin lokasi...' : 'GPS tidak diwajibkan');
    if (profile.requireGpsActive) void verifyGps();
    if (profile.requireSelfiePhoto) void startCameraStream();
  // Permission requests intentionally run once after a verified identity changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerManagementOnly, step, currentBranch.id, selectedStaff.id, profile.isAttendanceEnabled, profile.requireGpsActive, profile.requireSelfiePhoto]);

  const verifyPin = useCallback((pin: string) => {
    setIsVerifying(true);
    const result = DBStorage.authenticateByPin(currentBranch.id, pin);
    if (result.success && result.user) {
      const found = staffAccounts.find((s) => s.id === result.user!.id);
      if (found) {
        setSelectedStaff(found);
        setPinInput('');
        setStep('SELFIE_GPS');
        setIsVerifying(false);
        return;
      }
    }
    setPinError(result.message || 'PIN tidak cocok. Coba lagi.');
    setPinInput('');
    setIsVerifying(false);
  }, [currentBranch.id, staffAccounts]);

  const handlePinKey = useCallback((digit: string) => {
    if (isVerifying) return;
    setPinInput((prev) => {
      const next = (prev + digit).slice(0, 6);
      if (next.length === 6) {
        setTimeout(() => verifyPin(next), 50);
      }
      return next;
    });
    setPinError('');
  }, [isVerifying, verifyPin]);

  const handleClockAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (profile.isAttendanceEnabled === false) {
      onShowToast('Fitur Nonaktif', 'Fitur absensi sedang dinonaktifkan oleh Owner.');
      return;
    }
    setIsSubmitting(true);
    setUploadMessage('');
    if (profile.requireSelfiePhoto && !selfiePreview) {
      onShowToast('Selfie Diperlukan', 'Ambil foto selfie terbaru sebelum menyimpan absensi.');
      setIsSubmitting(false);
      return;
    }
    const gpsValidated = await verifyGps();
    if (profile.requireGpsActive && !gpsValidated) {
      onShowToast('Lokasi Gagal', 'Absensi ditolak karena lokasi belum terverifikasi.');
      setIsSubmitting(false);
      return;
    }
    const now = new Date();
    const scheduledStart = getScheduledStart();
    const [hour, minute] = scheduledStart.split(':').map(Number);
    const scheduledDate = new Date(now);
    scheduledDate.setHours(hour, minute, 0, 0);
    const minutesLate = clockType === 'CLOCK_IN' ? Math.max(0, Math.floor((now.getTime() - scheduledDate.getTime()) / 60_000)) : 0;
    const tolerance = profile.latenessToleranceMinutes || 0;
    let photoUrl = selfiePreview || selectedStaff.avatar || '';
    let photoPublicId = '';
    if (selfieFile) {
      try {
        setUploadMessage('Mengunggah bukti selfie ke cloud...');
        const uploaded = await uploadImage(selfieFile, 'attendance', currentBranch.id);
        photoUrl = uploaded.secureUrl;
        photoPublicId = uploaded.publicId;
      } catch (error) {
        onShowToast('Upload Gagal', error instanceof Error ? error.message : 'Upload selfie gagal.');
        setIsSubmitting(false);
        return;
      }
    }
    const record: AttendanceRecord = {
      id: crypto.randomUUID(),
      requestId: crypto.randomUUID(),
      staffId: selectedStaff.id,
      staffName: selectedStaff.name,
      role: selectedStaff.role,
      type: clockType,
      timestamp: new Date().toISOString(),
      location: currentBranch.name,
      photoUrl,
      photoPublicId,
      status: minutesLate > tolerance ? 'LATE' : 'ON_TIME',
      branchId: currentBranch.id,
      branchName: currentBranch.name,
      scheduledStart,
      minutesLate,
      verificationMethod: profile.requireSelfiePhoto ? 'PIN_GPS_SELFIE' : profile.requireGpsActive ? 'PIN_GPS' : 'PIN',
      gpsValidated,
      selfieValidated: !!selfiePreview,
      latitude: gpsPosition?.latitude,
      longitude: gpsPosition?.longitude,
      accuracyMeters: gpsPosition?.accuracy,
    };
    try {
      await onSaveAttendance(record);
    } catch (error) {
      onShowToast('Absensi Gagal', error instanceof Error ? error.message : 'Absensi tidak dapat disimpan.');
      setIsSubmitting(false);
      return;
    }
    setSelfiePreview('');
    setSelfieFile(null);
    permissionRequestKeyRef.current = '';
    setUploadMessage('');
    setIsSubmitting(false);
    stopCameraStream();
    // Ringkasan untuk layar sukses: durasi kerja bila ini CLOCK OUT.
    let workMinutes: number | null = null;
    if (clockType === 'CLOCK_OUT') {
      const lastIn = [...todayRecords].reverse().find((r) => r.type === 'CLOCK_IN');
      if (lastIn) workMinutes = Math.max(0, Math.round((Date.now() - new Date(lastIn.timestamp).getTime()) / 60000));
    }
    setLastSaved(record);
    setSuccessWorkMinutes(workMinutes);
    setStep('SUCCESS');
    setTimeout(() => {
      setStep(terminalMode || cloudReadiness.supabase ? 'SELFIE_GPS' : 'PIN');
      if (!terminalMode && !cloudReadiness.supabase) setSelectedStaff(eligibleStaff[0] || activeUser);
    }, 3000);
    onShowToast('Presensi Tersimpan', `${clockType === 'CLOCK_IN' ? 'CLOCK IN' : 'CLOCK OUT'} berhasil untuk ${selectedStaff.name}!`);
  };

  return (
    <div className="ui-surface flex flex-1 flex-col overflow-y-auto p-4 font-sans select-none md:p-6 text-[var(--text-primary)]">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-[var(--text-primary)]">
            <UserCheck className="h-7 w-7 text-[var(--primary-hover)]" />
            Presensi Karyawan
          </h1>
          <p className="mt-1 text-xs font-bold text-[var(--text-secondary)]">
            {terminalMode ? 'Terminal absensi aktif.' : ownerManagementOnly ? 'Mode manajemen — akun Owner tidak dicatat sebagai staff absensi.' : 'Masukkan PIN 6-digit — sistem otomatis mengenali identitas Anda.'}
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--panel-border)] bg-white px-4 py-2 shadow-sm">
          <Clock className="h-5 w-5 text-[var(--primary-hover)]" />
          <div className="text-right">
            <p className="font-mono text-lg font-black leading-none tracking-tight text-[var(--text-primary)] tabular-nums">
              {nowTs.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
              {nowTs.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })} · {currentBranch.name}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4">
          {ownerManagementOnly ? (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-wider text-blue-700">Mode Owner</p>
              <h2 className="mt-1 text-base font-extrabold text-blue-950">Owner tidak menggunakan absensi operasional</h2>
              <p className="mt-2 text-xs font-semibold leading-relaxed text-blue-800">Gunakan panel di samping untuk memantau presensi staff. Akun Owner/Super Owner tidak masuk rekap kehadiran maupun payroll.</p>
            </div>
          ) : (
            <>

          {step === 'PIN' && (
            <div className="rounded-2xl border border-[var(--panel-border)] bg-white p-6 shadow-sm space-y-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">Verifikasi Identitas</p>
                <h2 className="text-base font-extrabold text-[var(--text-primary)]">Masukkan PIN Anda</h2>
                <p className="text-[11px] font-medium text-[var(--text-secondary)]">PIN unik per karyawan — otomatis teridentifikasi</p>
              </div>

              <div className="flex items-center justify-center gap-3 py-2">
                {Array.from({ length: 6 }, (_, i) => (
                  <span
                    key={i}
                    className={`h-4 w-4 rounded-full border-2 transition-all ${
                      i < pinInput.length ? 'border-[var(--primary)] bg-[var(--primary)] scale-110' : 'border-[var(--panel-border-strong)] bg-[var(--surface-secondary)]'
                    }`}
                  />
                ))}
              </div>

              {pinError && (
                <p className="text-center text-xs font-bold text-[var(--accent-red)] bg-[var(--danger-soft)] rounded-2xl py-2 px-3 border border-[var(--danger-soft)]">{pinError}</p>
              )}
              {isVerifying && (
                <p className="text-center text-xs font-bold text-[var(--primary)] bg-[var(--primary-soft)] rounded-2xl py-2 px-3 border border-[var(--primary-border)]">Memverifikasi PIN...</p>
              )}

              <div className="grid grid-cols-3 gap-2">
                {['1','2','3','4','5','6','7','8','9'].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handlePinKey(d)}
                    disabled={isVerifying}
                    className="h-12 rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-main)] text-lg font-bold text-[var(--text-primary)] transition hover:border-[var(--primary-border)] hover:bg-[var(--primary-soft)] active:bg-[var(--primary)] active:text-white disabled:opacity-40 cursor-pointer"
                  >{d}</button>
                ))}
                <button type="button" onClick={() => { setPinInput(''); setPinError(''); }} disabled={isVerifying}
                  className="h-12 rounded-2xl bg-[var(--surface-secondary)] text-[11px] font-bold text-[var(--text-tertiary)] disabled:opacity-40 cursor-pointer hover:bg-[var(--panel-border)]">HAPUS</button>
                <button type="button" onClick={() => handlePinKey('0')} disabled={isVerifying}
                  className="h-12 rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-main)] text-lg font-bold text-[var(--text-primary)] transition hover:border-[var(--primary-border)] hover:bg-[var(--primary-soft)] active:bg-[var(--primary)] active:text-white disabled:opacity-40 cursor-pointer">0</button>
                <button type="button" onClick={() => { setPinInput((v) => v.slice(0, -1)); setPinError(''); }} disabled={isVerifying}
                  className="h-12 rounded-2xl bg-[var(--primary)] text-white flex items-center justify-center disabled:opacity-40 cursor-pointer hover:bg-[var(--primary-pressed)]">
                  <Delete className="w-4 h-4" />
                </button>
              </div>
              <p className="text-center text-[11px] font-bold text-[var(--text-tertiary)]">PIN bersifat unik per karyawan</p>
            </div>
          )}

          {step === 'SELFIE_GPS' && (
            <div className="rounded-2xl border border-[var(--panel-border)] bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3 rounded-2xl border border-[var(--primary-border)] bg-[var(--primary-soft)] p-3.5">
                <div className="h-12 w-12 overflow-hidden rounded-full border-2 border-[var(--primary)] shrink-0">
                  {selfiePreview || selectedStaff.avatar ? (
                    <img src={selfiePreview || selectedStaff.avatar} alt={selectedStaff.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[var(--primary)] text-xs font-bold text-white">{selectedStaff.name.slice(0, 2).toUpperCase()}</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[var(--text-primary)] truncate">{selectedStaff.name}</p>
                  <p className="text-[11px] font-bold text-[var(--primary-text)]">{selectedStaff.role} - {currentBranch.code}</p>
                  <p className="text-[11px] font-bold text-[var(--text-tertiary)]">Jadwal {getScheduledStart()}--{selectedStaff.shiftEnd || '-'}</p>
                </div>
                {!terminalMode && (
                  <button type="button" onClick={() => { stopCameraStream(); setStep('PIN'); setPinInput(''); setPinError(''); }}
                    className="ml-auto text-[11px] font-bold text-[var(--text-tertiary)] hover:text-[var(--text-primary)] shrink-0 cursor-pointer">Ganti</button>
                )}
              </div>

              <div className={`rounded-2xl border p-3.5 ${profile.isAttendanceEnabled !== false ? 'border-[var(--primary-border)] bg-[var(--primary-soft)]' : 'border-[var(--panel-border)] bg-[var(--surface-secondary)]'}`}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Aksi Berikutnya</p>
                <p className="mt-1 text-sm font-bold text-[var(--text-primary)]">{clockType === 'CLOCK_IN' ? 'CLOCK IN - Masuk Kerja' : 'CLOCK OUT - Selesai Kerja'}</p>
                <p className="mt-0.5 text-[11px] font-bold text-[var(--text-secondary)]">Toleransi {profile.latenessToleranceMinutes || 0} menit keterlambatan</p>
              </div>

              {(() => {
                const dayIdx = new Date().getDay();
                const workDays = effectiveWorkDays(selectedStaff, profile);
                const isOff = !workDays.includes(dayIdx);
                const dayName = WEEK_DAYS.find((day) => day.day === dayIdx)?.label || 'Hari ini';
                return (
                  <div className="rounded-2xl border border-[var(--panel-border)] bg-white p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-tertiary)]">Jadwal Mingguan</p>
                        <p className={`mt-1 text-xs font-black ${isOff ? 'text-rose-700' : 'text-emerald-700'}`}>{isOff ? `LIBUR RUTIN · ${dayName}` : `HARI KERJA · ${dayName}`}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[9px] font-black ${isOff ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{isOff ? 'OFF' : `${getScheduledStart()}–${selectedStaff.shiftEnd || '-'}`}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-7 gap-1">
                      {WEEK_DAYS.map((day) => {
                        const working = workDays.includes(day.day);
                        const today = day.day === dayIdx;
                        return <div key={day.day} className={`rounded-lg border px-1 py-2 text-center ${today ? 'ring-2 ring-[var(--primary)]/20' : ''} ${working ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-400'}`}><p className="text-[8px] font-black">{day.short}</p><p className="mt-0.5 text-[7px] font-bold">{working ? 'Masuk' : 'Libur'}</p></div>;
                      })}
                    </div>
                    {isOff && <p className="mt-2 text-[10px] font-semibold leading-snug text-rose-600">Jika tetap bekerja hari ini, presensi akan tercatat sebagai ekstra shift dan perlu ditinjau manajemen.</p>}
                  </div>
                );
              })()}

              {/* LIVE WEBCAM CAMERA CONTAINER */}
              <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center gap-3">
                {isCameraActive ? (
                  <div className="relative h-44 w-44 overflow-hidden rounded-full border-4 border-[var(--primary-border)] shadow-md bg-[var(--surface-secondary)]">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      onCanPlay={() => setIsCameraReady(true)}
                      onLoadedMetadata={() => setIsCameraReady(true)}
                      className="h-full w-full object-cover scale-x-[-1]"
                    />
                  </div>
                ) : selfiePreview ? (
                  <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-[var(--primary)] shadow-md">
                    <img src={selfiePreview} alt="selfie preview" className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="h-32 w-32 rounded-full border-4 border-dashed border-slate-300 flex items-center justify-center bg-white shadow-inner">
                    <Camera className="w-10 h-10 text-slate-400" />
                  </div>
                )}

                {cameraError && (
                  <p className="text-[11px] font-bold text-rose-600 bg-rose-50 px-3 py-1 rounded-full border border-rose-200">{cameraError}</p>
                )}

                {/* Camera Buttons Control */}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {isCameraActive ? (
                    <button
                      type="button"
                      onClick={captureLiveSnapshot}
                      disabled={!isCameraReady}
                      className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[var(--primary-solid)] to-[var(--primary-light)] hover:from-[var(--primary-solid)] hover:to-[var(--primary-light)] px-5 py-2.5 text-xs font-bold text-white shadow-md transition-all active:scale-95 cursor-pointer disabled:cursor-wait disabled:opacity-50"
                    >
                      <Camera className="h-4 w-4" />
                      {isCameraReady ? 'Potret Live Selfie' : 'Menyiapkan Kamera...'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startCameraStream}
                      className="flex items-center gap-1.5 rounded-full bg-[var(--primary)] hover:bg-[var(--brand-800)] px-4 py-2 text-[11px] font-bold text-white shadow-sm transition-all cursor-pointer"
                    >
                      <Video className="h-3.5 w-3.5 text-[var(--primary-text)]" />
                      {selfiePreview ? 'Ambil Selfie Ulang (Kamera Live)' : 'Buka Kamera Live'}
                    </button>
                  )}

                </div>

                <p className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-tertiary)]">
                  <ShieldCheck className="h-3.5 w-3.5 text-[var(--primary-text)]" />
                  Bukti presensi hanya dapat diambil langsung dari kamera perangkat.
                </p>

                <div className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                  <div className="flex items-start gap-2 text-[11px] font-bold text-[var(--text-secondary)]">
                    <MapPin className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${isGpsValid ? 'text-emerald-600' : 'text-amber-600'}`} />
                    <div className="min-w-0 flex-1"><span>{gpsMessage}</span>{gpsPosition && <div className="mt-1.5 flex flex-wrap gap-1.5"><span className={`rounded-full px-2 py-0.5 text-[8px] font-black ${gpsPosition.accuracy <= Math.max(5, Number(profile.maxGpsAccuracyMeters || 80)) ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>AKURASI ±{Math.round(gpsPosition.accuracy)} M</span><span className={`rounded-full px-2 py-0.5 text-[8px] font-black ${isGpsValid ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{isGpsValid ? 'DALAM AREA' : 'BELUM VALID'}</span></div>}</div>
                  </div>
                </div>
                {profile.requireGpsActive && (
                  <button type="button" onClick={() => verifyGps()} className="text-[11px] font-bold text-[var(--primary-text)] hover:text-[var(--primary-text)] underline cursor-pointer">
                    Verifikasi Lokasi GPS
                  </button>
                )}
                {uploadMessage && <p className="text-[11px] font-extrabold text-[var(--primary-text)]">{uploadMessage}</p>}
              </div>

              <button onClick={handleClockAction} disabled={!configReady || profile.isAttendanceEnabled === false || !hasEligibleIdentity || isSubmitting || (profile.requireSelfiePhoto && !selfieFile) || (profile.requireGpsActive && !isGpsValid)}
                className="w-full rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--primary-light)] hover:from-[var(--primary-solid)] hover:to-[var(--primary-light)] py-3.5 text-xs font-bold text-white transition-all shadow-[var(--shadow-md)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer">
                {isSubmitting ? 'MENYIMPAN PRESENSI...' : clockType === 'CLOCK_IN' ? 'CLOCK IN SEKARANG' : 'CLOCK OUT SEKARANG'}
              </button>
              {!configReady && (
                <p className="text-center text-[10px] font-semibold text-amber-700">Memuat aturan absensi outlet...</p>
              )}
              {configReady && !isSubmitting && ((profile.requireSelfiePhoto && !selfieFile) || (profile.requireGpsActive && !isGpsValid)) && (
                <p className="text-center text-[11px] font-bold text-slate-500">
                  {profile.requireSelfiePhoto && !selfieFile ? 'Ambil selfie langsung terlebih dahulu. ' : ''}
                  {profile.requireGpsActive && !isGpsValid ? 'Pastikan GPS valid di area outlet.' : ''}
                </p>
              )}
            </div>
          )}

          {step === 'SUCCESS' && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 shadow-sm flex flex-col items-center text-center gap-4">
              <CheckCircle2 className="w-16 h-16 text-emerald-500" />
              <div>
                <p className="text-lg font-bold text-emerald-900">Presensi Berhasil!</p>
                <p className="text-sm font-bold text-emerald-700">{lastSaved?.staffName || selectedStaff.name}</p>
              </div>
              {lastSaved && (
                <div className="w-full space-y-2">
                  <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-white px-4 py-2.5">
                    <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700">
                      {lastSaved.type === 'CLOCK_IN' ? 'Jam Masuk' : 'Jam Pulang'}
                    </span>
                    <span className="font-mono text-lg font-black text-emerald-900 tabular-nums">
                      {new Date(lastSaved.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {lastSaved.type === 'CLOCK_IN' && (
                    <div className={`rounded-xl px-4 py-2 text-[12px] font-black ${lastSaved.status === 'LATE' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {lastSaved.status === 'LATE' ? `TERLAMBAT ${lastSaved.minutesLate || 0} MENIT` : 'TEPAT WAKTU'}
                    </div>
                  )}
                  {lastSaved.type === 'CLOCK_OUT' && successWorkMinutes != null && (
                    <div className="rounded-xl bg-emerald-100 px-4 py-2 text-[12px] font-black text-emerald-700">
                      DURASI KERJA {Math.floor(successWorkMinutes / 60)}j {successWorkMinutes % 60}m
                    </div>
                  )}
                </div>
              )}
              <p className="text-[11px] font-bold text-emerald-500">Kembali otomatis dalam 3 detik...</p>
            </div>
          )}
            </>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--panel-border)] bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="mb-4 text-base font-bold text-[var(--text-primary)]">
            {['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN'].includes(activeUser.role) && !terminalMode
              ? 'Presensi Staff Hari Ini'
              : 'Presensi Saya Hari Ini'}
          </h2>
          <div className="max-h-[500px] space-y-2 overflow-y-auto pr-1">
            {(() => {
              const today = new Date().toDateString();
              const canViewBranch = ['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN'].includes(activeUser.role) && !terminalMode;
              const visibleRecords = attendanceRecords.filter((record) =>
                new Date(record.timestamp).toDateString() === today
                && record.role !== 'OWNER'
                && record.role !== 'SUPER_OWNER'
                && (canViewBranch || record.staffId === activeUser.id),
              );
              return visibleRecords.length === 0 ? (
              <p className="py-12 text-center text-xs font-bold text-slate-400">Belum ada aktivitas presensi hari ini</p>
            ) : (
              visibleRecords
                .slice()
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .map((att) => (
                  <div key={att.id} className="flex items-center justify-between rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-secondary)] p-3.5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 overflow-hidden rounded-full border border-[var(--panel-border)] shrink-0">
                        {att.photoUrl ? <img src={att.photoUrl} alt={att.staffName} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center bg-[var(--primary)] text-[11px] font-bold text-white">{att.staffName.slice(0, 2).toUpperCase()}</div>}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[var(--text-primary)]">{att.staffName} <span className="text-[11px] font-bold text-[var(--primary-hover)]">({att.role})</span></p>
                        <p className="text-[11px] font-bold text-[var(--text-tertiary)]">{att.location} - Jadwal {att.scheduledStart || '-'}</p>
                        {att.gpsValidated && <p className="text-[11px] font-bold text-[var(--accent-green)]">GPS Terverifikasi</p>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${att.type === 'CLOCK_IN' ? 'bg-[var(--primary-soft)] text-[var(--primary-hover)] border border-[var(--primary-border)]' : 'bg-[var(--primary)] text-white'}`}>
                        {att.type === 'CLOCK_IN' ? 'CLOCK IN' : 'CLOCK OUT'}
                      </span>
                      <p className="mt-1 text-xs font-mono font-bold text-[var(--text-primary)]">{new Date(att.timestamp).toLocaleTimeString('id-ID')}</p>
                    </div>
                  </div>
                ))
              );
            })()}
          </div>
        </div>
      </div>
      <AttendanceHrPanel
        activeUser={activeUser}
        staffAccounts={staffAccounts}
        currentBranch={currentBranch}
        attendanceRecords={attendanceRecords}
        terminalMode={terminalMode}
        onShowToast={onShowToast}
      />
    </div>
  );
};

