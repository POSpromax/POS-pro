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
  onShowToast: (title: string, message: string) => void;
}

type AttendanceStep = 'PIN' | 'SELFIE_GPS' | 'SUCCESS';

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  attendanceRecords,
  onSaveAttendance,
  activeUser,
  staffAccounts,
  profile,
  currentBranch,
  terminalMode = false,
  onShowToast,
}) => {
  const eligibleStaff = useMemo(
    () => staffAccounts.filter(
      (staff) => staff.isActive !== false && (!staff.branchIds?.length || staff.branchIds.includes(currentBranch.id)),
    ),
    [staffAccounts, currentBranch.id],
  );

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
    const outletLatitude = currentBranch.gpsLatitude ?? (currentBranch.isMainBranch ? profile.gpsLatitude : undefined);
    const outletLongitude = currentBranch.gpsLongitude ?? (currentBranch.isMainBranch ? profile.gpsLongitude : undefined);
    const outletRadius = currentBranch.gpsRadiusMeters ?? (currentBranch.isMainBranch ? profile.gpsRadiusMeters : undefined) ?? 50;
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
          const allowed = distance <= outletRadius;
          setGpsPosition({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
          setGpsMessage(allowed ? `GPS valid - ${Math.round(distance)} m dari outlet` : `Di luar radius - ${Math.round(distance)} m`);
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
    if (step !== 'SELFIE_GPS' || profile.isAttendanceEnabled === false) return;
    const requestKey = `${currentBranch.id}:${selectedStaff.id}`;
    if (permissionRequestKeyRef.current === requestKey) return;
    permissionRequestKeyRef.current = requestKey;
    setGpsMessage(profile.requireGpsActive ? 'Meminta izin lokasi...' : 'GPS tidak diwajibkan');
    if (profile.requireGpsActive) void verifyGps();
    if (profile.requireSelfiePhoto) void startCameraStream();
  // Permission requests intentionally run once after a verified identity changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, currentBranch.id, selectedStaff.id, profile.isAttendanceEnabled, profile.requireGpsActive, profile.requireSelfiePhoto]);

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
    setStep('SUCCESS');
    setTimeout(() => {
      setStep(terminalMode || cloudReadiness.supabase ? 'SELFIE_GPS' : 'PIN');
      if (!terminalMode && !cloudReadiness.supabase) setSelectedStaff(eligibleStaff[0] || activeUser);
    }, 3000);
    onShowToast('Presensi Tersimpan', `${clockType === 'CLOCK_IN' ? 'CLOCK IN' : 'CLOCK OUT'} berhasil untuk ${selectedStaff.name}!`);
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-[#F8FAFC] p-4 font-sans select-none md:p-6 text-slate-900">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-[#1A1714]">
            <UserCheck className="h-7 w-7 text-[#EA580C]" />
            Presensi Karyawan
          </h1>
          <p className="mt-1 text-xs font-bold text-slate-500">
            {terminalMode ? 'Terminal absensi aktif.' : 'Masukkan PIN 6-digit — sistem otomatis mengenali identitas Anda.'}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
          <Clock className="w-3.5 h-3.5" />
          {currentBranch.name}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4">

          {step === 'PIN' && (
            <div className="rounded-3xl border border-[#EAE3DB] bg-white p-6 shadow-sm space-y-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Verifikasi Identitas</p>
                <h2 className="text-base font-black text-slate-900">Masukkan PIN Anda</h2>
                <p className="text-[11px] font-medium text-slate-500">PIN unik per karyawan — otomatis teridentifikasi</p>
              </div>

              <div className="flex items-center justify-center gap-3 py-2">
                {Array.from({ length: 6 }, (_, i) => (
                  <span
                    key={i}
                    className={`h-4 w-4 rounded-full border-2 transition-all ${
                      i < pinInput.length ? 'border-[#EA580C] bg-[#EA580C] scale-110' : 'border-slate-300 bg-slate-100'
                    }`}
                  />
                ))}
              </div>

              {pinError && (
                <p className="text-center text-xs font-bold text-rose-600 bg-rose-50 rounded-2xl py-2 px-3 border border-rose-200">{pinError}</p>
              )}
              {isVerifying && (
                <p className="text-center text-xs font-bold text-blue-600 bg-blue-50 rounded-2xl py-2 px-3 border border-blue-200">Memverifikasi PIN...</p>
              )}

              <div className="grid grid-cols-3 gap-2">
                {['1','2','3','4','5','6','7','8','9'].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handlePinKey(d)}
                    disabled={isVerifying}
                    className="h-12 rounded-2xl border border-[#E7E2DE] bg-[#F8F7F5] text-lg font-black text-[#1A1714] transition hover:border-orange-300 hover:bg-orange-50 active:bg-[#EA580C] active:text-white disabled:opacity-40 cursor-pointer"
                  >{d}</button>
                ))}
                <button type="button" onClick={() => { setPinInput(''); setPinError(''); }} disabled={isVerifying}
                  className="h-12 rounded-2xl bg-slate-100 text-[9px] font-black text-slate-500 disabled:opacity-40 cursor-pointer hover:bg-slate-200">HAPUS</button>
                <button type="button" onClick={() => handlePinKey('0')} disabled={isVerifying}
                  className="h-12 rounded-2xl border border-[#E7E2DE] bg-[#F8F7F5] text-lg font-black text-[#1A1714] transition hover:border-orange-300 hover:bg-orange-50 active:bg-[#EA580C] active:text-white disabled:opacity-40 cursor-pointer">0</button>
                <button type="button" onClick={() => { setPinInput((v) => v.slice(0, -1)); setPinError(''); }} disabled={isVerifying}
                  className="h-12 rounded-2xl bg-[#1A1917] text-white flex items-center justify-center disabled:opacity-40 cursor-pointer hover:bg-black">
                  <Delete className="w-4 h-4" />
                </button>
              </div>
              <p className="text-center text-[9px] font-bold text-slate-400">PIN bersifat unik per karyawan</p>
            </div>
          )}

          {step === 'SELFIE_GPS' && (
            <div className="rounded-3xl border border-[#EAE3DB] bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-3.5">
                <div className="h-12 w-12 overflow-hidden rounded-full border-2 border-orange-400 shrink-0">
                  {selfiePreview || selectedStaff.avatar ? (
                    <img src={selfiePreview || selectedStaff.avatar} alt={selectedStaff.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[#1A1917] text-xs font-black text-white">{selectedStaff.name.slice(0, 2).toUpperCase()}</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-slate-900 truncate">{selectedStaff.name}</p>
                  <p className="text-[10px] font-bold text-orange-600">{selectedStaff.role} - {currentBranch.code}</p>
                  <p className="text-[10px] font-bold text-slate-400">Jadwal {getScheduledStart()}--{selectedStaff.shiftEnd || '-'}</p>
                </div>
                {!terminalMode && (
                  <button type="button" onClick={() => { stopCameraStream(); setStep('PIN'); setPinInput(''); setPinError(''); }}
                    className="ml-auto text-[10px] font-bold text-slate-400 hover:text-slate-700 shrink-0 cursor-pointer">Ganti</button>
                )}
              </div>

              <div className={`rounded-2xl border p-3.5 ${profile.isAttendanceEnabled !== false ? 'border-orange-200 bg-orange-50/50' : 'border-slate-200 bg-slate-50'}`}>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Aksi Berikutnya</p>
                <p className="mt-1 text-sm font-black text-slate-900">{clockType === 'CLOCK_IN' ? 'CLOCK IN - Masuk Kerja' : 'CLOCK OUT - Selesai Kerja'}</p>
                <p className="mt-0.5 text-[10px] font-bold text-slate-500">Toleransi {profile.latenessToleranceMinutes || 0} menit keterlambatan</p>
              </div>

              {(() => {
                const dayIdx = new Date().getDay();
                const isOff = (profile.weeklyOffDays || [0]).includes(dayIdx);
                const dayName = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][dayIdx];
                return isOff ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3">
                    <p className="font-black text-xs text-rose-900">HARI LIBUR RUTIN ({dayName.toUpperCase()})</p>
                    <p className="text-[11px] font-semibold text-rose-700 leading-snug mt-1">Dicatat sebagai Kerja Lembur / Ekstra Shift.</p>
                  </div>
                ) : null;
              })()}

              {/* LIVE WEBCAM CAMERA CONTAINER */}
              <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center gap-3">
                {isCameraActive ? (
                  <div className="relative h-44 w-44 overflow-hidden rounded-full border-4 border-orange-500 shadow-lg bg-black">
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
                  <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-orange-400 shadow-md">
                    <img src={selfiePreview} alt="selfie preview" className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="h-32 w-32 rounded-full border-4 border-dashed border-slate-300 flex items-center justify-center bg-white shadow-inner">
                    <Camera className="w-10 h-10 text-slate-400" />
                  </div>
                )}

                {cameraError && (
                  <p className="text-[10px] font-bold text-rose-600 bg-rose-50 px-3 py-1 rounded-full border border-rose-200">{cameraError}</p>
                )}

                {/* Camera Buttons Control */}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {isCameraActive ? (
                    <button
                      type="button"
                      onClick={captureLiveSnapshot}
                      disabled={!isCameraReady}
                      className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600 px-5 py-2.5 text-xs font-black text-white shadow-md transition-all active:scale-95 cursor-pointer disabled:cursor-wait disabled:opacity-50"
                    >
                      <Camera className="h-4 w-4" />
                      {isCameraReady ? 'Potret Live Selfie' : 'Menyiapkan Kamera...'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startCameraStream}
                      className="flex items-center gap-1.5 rounded-full bg-slate-900 hover:bg-slate-700 px-4 py-2 text-[11px] font-black text-white shadow-sm transition-all cursor-pointer"
                    >
                      <Video className="h-3.5 w-3.5 text-orange-400" />
                      {selfiePreview ? 'Ambil Selfie Ulang (Kamera Live)' : 'Buka Kamera Live'}
                    </button>
                  )}

                </div>

                <p className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400">
                  <ShieldCheck className="h-3.5 w-3.5 text-orange-500" />
                  Bukti presensi hanya dapat diambil langsung dari kamera perangkat.
                </p>

                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                  <MapPin className="w-3.5 h-3.5 text-orange-500" />
                  <span>{gpsMessage}</span>
                </div>
                {profile.requireGpsActive && (
                  <button type="button" onClick={() => verifyGps()} className="text-[10px] font-black text-orange-600 hover:text-orange-800 underline cursor-pointer">
                    Verifikasi Lokasi GPS
                  </button>
                )}
                {uploadMessage && <p className="text-[9px] font-extrabold text-orange-600">{uploadMessage}</p>}
              </div>

              <button onClick={handleClockAction} disabled={profile.isAttendanceEnabled === false || eligibleStaff.length === 0 || isSubmitting || (profile.requireSelfiePhoto && !selfieFile) || (profile.requireGpsActive && !isGpsValid)}
                className="w-full rounded-full bg-gradient-to-r from-[#EA580C] to-[#F97316] hover:from-orange-700 hover:to-orange-600 py-3.5 text-xs font-black text-white transition-all shadow-md shadow-orange-500/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer">
                {isSubmitting ? 'MENYIMPAN PRESENSI...' : clockType === 'CLOCK_IN' ? 'CLOCK IN SEKARANG' : 'CLOCK OUT SEKARANG'}
              </button>
              {!isSubmitting && ((profile.requireSelfiePhoto && !selfieFile) || (profile.requireGpsActive && !isGpsValid)) && (
                <p className="text-center text-[10px] font-bold text-slate-500">
                  {profile.requireSelfiePhoto && !selfieFile ? 'Ambil selfie langsung terlebih dahulu. ' : ''}
                  {profile.requireGpsActive && !isGpsValid ? 'Pastikan GPS valid di area outlet.' : ''}
                </p>
              )}
            </div>
          )}

          {step === 'SUCCESS' && (
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 shadow-sm flex flex-col items-center text-center gap-4">
              <CheckCircle2 className="w-16 h-16 text-emerald-500" />
              <div>
                <p className="text-lg font-black text-emerald-900">Presensi Berhasil!</p>
                <p className="text-sm font-bold text-emerald-700">{selectedStaff.name}</p>
                <p className="text-xs font-bold text-emerald-600 mt-1">{clockType === 'CLOCK_IN' ? 'CLOCK IN' : 'CLOCK OUT'} tercatat</p>
              </div>
              <p className="text-[10px] font-bold text-emerald-500">Kembali otomatis dalam 3 detik...</p>
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-[#EAE3DB] bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="mb-4 text-base font-black text-[#1A1714]">
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
                && (canViewBranch || record.staffId === activeUser.id),
              );
              return visibleRecords.length === 0 ? (
              <p className="py-12 text-center text-xs font-bold text-slate-400">Belum ada aktivitas presensi hari ini</p>
            ) : (
              visibleRecords
                .slice()
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .map((att) => (
                  <div key={att.id} className="flex items-center justify-between rounded-2xl border border-[#EAE3DB] bg-[#F8F2EC] p-3.5 shadow-2xs">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 overflow-hidden rounded-full border border-[#EAE3DB] shrink-0">
                        {att.photoUrl ? <img src={att.photoUrl} alt={att.staffName} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center bg-[#1A1917] text-[10px] font-black text-white">{att.staffName.slice(0, 2).toUpperCase()}</div>}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#1A1714]">{att.staffName} <span className="text-[10px] font-black text-[#EA580C]">({att.role})</span></p>
                        <p className="text-[10px] font-bold text-slate-400">{att.location} - Jadwal {att.scheduledStart || '-'}</p>
                        {att.gpsValidated && <p className="text-[9px] font-bold text-emerald-600">GPS Terverifikasi</p>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${att.type === 'CLOCK_IN' ? 'bg-[#FFF4ED] text-[#EA580C] border border-[#FFDDD0]' : 'bg-[#1A1714] text-white'}`}>
                        {att.type === 'CLOCK_IN' ? 'CLOCK IN' : 'CLOCK OUT'}
                      </span>
                      <p className="mt-1 text-xs font-mono font-black text-slate-800">{new Date(att.timestamp).toLocaleTimeString('id-ID')}</p>
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

