import React, { useEffect, useMemo, useState } from 'react';
import { Camera, MapPin, UserCheck } from 'lucide-react';
import { AttendanceRecord, Branch, RestaurantProfile, UserAccount } from '../../types/pos';
import { cloudReadiness } from '../../lib/runtimeEnv';
import { uploadImage } from '../../services/cloudinaryMedia';
import { DBStorage } from '../../services/dbStorage';

interface AttendanceViewProps {
  attendanceRecords: AttendanceRecord[];
  onSaveAttendance: (record: AttendanceRecord) => void;
  activeUser: UserAccount;
  staffAccounts: UserAccount[];
  profile: RestaurantProfile;
  currentBranch: Branch;
  terminalMode?: boolean;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  attendanceRecords,
  onSaveAttendance,
  activeUser,
  staffAccounts,
  profile,
  currentBranch,
  terminalMode = false,
}) => {
  const eligibleStaff = staffAccounts.filter(
    (staff) => staff.isActive !== false && (!staff.branchIds?.length || staff.branchIds.includes(currentBranch.id)),
  );
  const [selectedStaff, setSelectedStaff] = useState<UserAccount>(
    eligibleStaff.find((staff) => staff.id === activeUser.id) || eligibleStaff[0] || activeUser,
  );
  const [pinInput, setPinInput] = useState('');
  const [selfiePreview, setSelfiePreview] = useState('');
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [gpsMessage, setGpsMessage] = useState('GPS belum diverifikasi');
  const [uploadMessage, setUploadMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setSelectedStaff(eligibleStaff.find((staff) => staff.id === activeUser.id) || eligibleStaff[0] || activeUser);
    setPinInput('');
    setSelfiePreview('');
    setSelfieFile(null);
    setGpsMessage('GPS belum diverifikasi');
    setUploadMessage('');
  }, [currentBranch.id, activeUser.id, eligibleStaff, activeUser]);

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
    if (!profile.requireGpsActive) return true;

    const outletLatitude = currentBranch.gpsLatitude ?? (currentBranch.isMainBranch ? profile.gpsLatitude : undefined);
    const outletLongitude = currentBranch.gpsLongitude ?? (currentBranch.isMainBranch ? profile.gpsLongitude : undefined);
    const outletRadius = currentBranch.gpsRadiusMeters ?? (currentBranch.isMainBranch ? profile.gpsRadiusMeters : undefined) ?? 50;

    if (!navigator.geolocation || outletLatitude === undefined || outletLongitude === undefined) {
      setGpsMessage('Konfigurasi GPS outlet belum lengkap');
      return false;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const toRad = (value: number) => (value * Math.PI) / 180;
          const earthRadius = 6_371_000;
          const dLat = toRad(position.coords.latitude - outletLatitude);
          const dLng = toRad(position.coords.longitude - outletLongitude);
          const lat1 = toRad(outletLatitude);
          const lat2 = toRad(position.coords.latitude);
          const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
          const distance = earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const allowed = distance <= outletRadius;
          setGpsMessage(allowed ? `GPS valid • ${Math.round(distance)} m dari outlet` : `Di luar radius • ${Math.round(distance)} m`);
          resolve(allowed);
        },
        () => {
          setGpsMessage('Izin GPS diperlukan untuk absensi');
          resolve(false);
        },
        { enableHighAccuracy: true, timeout: 10_000 },
      );
    });
  };

  const handleSelfieFileChange = (file?: File) => {
    if (!file) return;
    setSelfieFile(file);
    setUploadMessage('');
    const reader = new FileReader();
    reader.onload = () => setSelfiePreview(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const handleClockAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (profile.isAttendanceEnabled === false) {
      alert('Fitur absensi sedang dinonaktifkan oleh Owner.');
      return;
    }

    setIsSubmitting(true);
    setUploadMessage('');

    if (!terminalMode) {
      const authResult = DBStorage.authenticateUser(selectedStaff.id, pinInput);
      if (!authResult.success) {
        alert(authResult.message);
        setPinInput('');
        setIsSubmitting(false);
        return;
      }
    }

    if (profile.requireSelfiePhoto && !selfiePreview) {
      alert('Ambil foto selfie terbaru sebelum menyimpan absensi.');
      setIsSubmitting(false);
      return;
    }

    const gpsValidated = await verifyGps();
    if (profile.requireGpsActive && !gpsValidated) {
      alert('Absensi ditolak karena lokasi belum terverifikasi.');
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

    let photoUrl = selfiePreview || selectedStaff.avatar;
    if (selfieFile && cloudReadiness.cloudinary) {
      try {
        setUploadMessage('Mengunggah bukti selfie ke cloud...');
        const uploaded = await uploadImage(selfieFile, 'attendance', currentBranch.id);
        photoUrl = uploaded.secureUrl;
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Upload selfie gagal.');
        setIsSubmitting(false);
        return;
      }
    }

    const record: AttendanceRecord = {
      id: `att-${Date.now().toString().slice(-4)}`,
      staffId: selectedStaff.id,
      staffName: selectedStaff.name,
      role: selectedStaff.role,
      type: clockType,
      timestamp: new Date().toISOString(),
      location: currentBranch.name,
      photoUrl,
      status: minutesLate > tolerance ? 'LATE' : 'ON_TIME',
      branchId: currentBranch.id,
      branchName: currentBranch.name,
      scheduledStart,
      minutesLate,
      verificationMethod: profile.requireSelfiePhoto ? 'PIN_GPS_SELFIE' : profile.requireGpsActive ? 'PIN_GPS' : 'PIN',
      gpsValidated,
      selfieValidated: !!selfiePreview,
    };

    onSaveAttendance(record);
    setPinInput('');
    setSelfiePreview('');
    setSelfieFile(null);
    setUploadMessage('');
    setIsSubmitting(false);
    alert(`Presensi ${clockType === 'CLOCK_IN' ? 'MASUK' : 'KELUAR'} berhasil disimpan untuk ${selectedStaff.name}!`);
  };

  return (
    <div className="flex flex-1 flex-col justify-between overflow-y-auto bg-[#F8FAFC] p-4 font-sans select-none md:p-6 text-slate-900">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-[#1A1714]">
            <UserCheck className="h-7 w-7 text-[#EA580C]" />
            Presensi Karyawan POS
          </h1>
          <p className="mt-1 text-xs font-bold text-slate-500">
            Presensi mengikuti identitas PIN, validasi lokasi outlet, dan bukti selfie sesuai kebijakan cabang.
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col justify-between rounded-2xl border border-[#EAE3DB] bg-white p-6 shadow-2xs">
          <div>
            <h2 className="mb-4 text-base font-black text-[#1A1714]">Form Presensi Staf</h2>

            <div className={`mb-4 rounded-2xl border p-4 ${profile.isAttendanceEnabled !== false ? 'border-orange-200 bg-orange-50' : 'border-slate-200 bg-slate-50'}`}>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Aksi Berikutnya</p>
              <p className="mt-1 text-sm font-black text-slate-900">{clockType === 'CLOCK_IN' ? 'CLOCK IN • Masuk Kerja' : 'CLOCK OUT • Selesai Kerja'}</p>
              <p className="mt-1 text-[10px] font-bold text-slate-500">
                Jadwal {getScheduledStart()}–{selectedStaff.shiftEnd || '-'} • Toleransi {profile.latenessToleranceMinutes || 0} menit
              </p>
            </div>

            <div className="space-y-3">
              {!terminalMode && (
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Pilih Staf</label>
                  <select
                    value={selectedStaff.id}
                    onChange={(e) => {
                      const st = eligibleStaff.find((s) => s.id === e.target.value);
                      if (st) setSelectedStaff(st);
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-black text-slate-900 outline-none focus:border-slate-900 focus:bg-white"
                  >
                    {eligibleStaff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {terminalMode && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Identitas Terverifikasi</p>
                  <p className="mt-1 text-sm font-black text-slate-900">{selectedStaff.name}</p>
                  <p className="text-[10px] font-bold text-slate-500">{selectedStaff.role} · {currentBranch.code}</p>
                </div>
              )}

              <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
                <div className="mb-2 h-16 w-16 overflow-hidden rounded-full border-2 border-orange-500 shadow-xs">
                  <img src={selfiePreview || selectedStaff.avatar} alt={selectedStaff.name} className="h-full w-full object-cover" />
                </div>
                <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700">
                  <MapPin className="h-3.5 w-3.5 text-orange-600" />
                  <span>{currentBranch.name}</span>
                </div>
                <p className="mt-1 text-[9px] font-bold text-slate-400">{gpsMessage}</p>
                {uploadMessage && <p className="mt-2 text-[9px] font-extrabold text-orange-600">{uploadMessage}</p>}
                <label className="mt-3 flex cursor-pointer items-center gap-1.5 rounded-full bg-slate-900 hover:bg-slate-800 px-3.5 py-2 text-[10px] font-black text-white shadow-xs transition-all">
                  <Camera className="h-3.5 w-3.5 text-orange-400" /> {selfiePreview ? 'Foto Ulang' : 'Ambil Selfie'}
                  <input
                    type="file"
                    accept="image/*"
                    capture="user"
                    className="hidden"
                    onChange={(e) => handleSelfieFileChange(e.target.files?.[0])}
                  />
                </label>
                <p className="mt-2 text-[9px] font-bold text-slate-400">
                  {cloudReadiness.cloudinary ? 'Cloud aktif • Bukti selfie diunggah ke storage terproteksi.' : 'Pratinjau bukti selfie disimpan lokal.'}
                </p>
              </div>

              {!terminalMode && (
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Masukkan PIN Staf</label>
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="****"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    className="w-full rounded-2xl border border-[#EAE3DB] bg-[#F6EFE7] px-3.5 py-2.5 text-center text-lg font-black tracking-widest text-[#1A1714] outline-none focus:border-[#EA580C] focus:bg-white"
                  />
                </div>
              )}

              <button
                onClick={handleClockAction}
                disabled={profile.isAttendanceEnabled === false || eligibleStaff.length === 0 || isSubmitting}
                className="w-full rounded-full bg-gradient-to-r from-[#EA580C] to-[#F97316] hover:from-orange-700 hover:to-orange-600 py-3 text-xs font-black text-white transition-all shadow-md shadow-orange-500/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
              >
                {isSubmitting
                  ? 'MENYIMPAN PRESENSI...'
                  : terminalMode
                    ? (clockType === 'CLOCK_IN' ? 'CLOCK IN SEKARANG' : 'CLOCK OUT SEKARANG')
                    : (clockType === 'CLOCK_IN' ? 'VERIFIKASI & CLOCK IN' : 'VERIFIKASI & CLOCK OUT')}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#EAE3DB] bg-white p-6 shadow-2xs lg:col-span-2">
          <h2 className="mb-4 text-base font-black text-[#1A1714]">Riwayat Presensi Karyawan Hari Ini</h2>
          <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {(terminalMode ? todayRecords : attendanceRecords).length === 0 ? (
              <p className="py-12 text-center text-xs font-bold text-slate-400">Belum ada aktivitas presensi hari ini</p>
            ) : (
              (terminalMode ? todayRecords : attendanceRecords).map((att) => (
                <div key={att.id} className="flex items-center justify-between rounded-2xl border border-[#EAE3DB] bg-[#F8F2EC] p-3.5 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 overflow-hidden rounded-full border border-[#EAE3DB]">
                      <img src={att.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'} alt={att.staffName} className="h-full w-full object-cover" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#1A1714]">
                        {att.staffName} <span className="text-[10px] font-black text-[#EA580C]">({att.role})</span>
                      </p>
                      <p className="text-[10px] font-bold text-slate-400">{att.location} • Jadwal {att.scheduledStart || '-'}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${att.type === 'CLOCK_IN' ? 'bg-[#FFF4ED] text-[#EA580C] border border-[#FFDDD0]' : 'bg-[#1A1714] text-white'}`}>
                      {att.type === 'CLOCK_IN' ? 'CLOCK IN' : 'CLOCK OUT'}
                    </span>
                    <p className="mt-1 text-xs font-mono font-black text-slate-800">
                      {new Date(att.timestamp).toLocaleTimeString('id-ID')}
                    </p>
                    {att.status === 'LATE' && <p className="text-[9px] font-black text-rose-600">Terlambat {att.minutesLate || 0} menit</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
