import React, { useEffect, useMemo, useState } from 'react';
import { UserCheck, MapPin, Camera } from 'lucide-react';
import { AttendanceRecord, UserAccount, RestaurantProfile, Branch } from '../../types/pos';
import { DBStorage } from '../../services/dbStorage';

interface AttendanceViewProps {
  attendanceRecords: AttendanceRecord[];
  onSaveAttendance: (record: AttendanceRecord) => void;
  activeUser: UserAccount;
  staffAccounts: UserAccount[];
  profile: RestaurantProfile;
  currentBranch: Branch;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  attendanceRecords,
  onSaveAttendance,
  activeUser,
  staffAccounts,
  profile,
  currentBranch
}) => {
  const eligibleStaff = staffAccounts.filter(
    (staff) => staff.isActive !== false && (!staff.branchIds?.length || staff.branchIds.includes(currentBranch.id))
  );
  const [selectedStaff, setSelectedStaff] = useState<UserAccount>(
    eligibleStaff.find((staff) => staff.id === activeUser.id) || eligibleStaff[0] || activeUser
  );
  const [pinInput, setPinInput] = useState<string>('');
  const [selfiePreview, setSelfiePreview] = useState<string>('');
  const [gpsMessage, setGpsMessage] = useState<string>('GPS belum diverifikasi');

  useEffect(() => {
    setSelectedStaff(eligibleStaff.find((staff) => staff.id === activeUser.id) || eligibleStaff[0] || activeUser);
    setPinInput('');
    setSelfiePreview('');
    setGpsMessage('GPS belum diverifikasi');
  }, [currentBranch.id, activeUser.id]);

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
        { enableHighAccuracy: true, timeout: 10_000 }
      );
    });
  };

  const handleClockAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profile.isAttendanceEnabled === false) {
      alert('Fitur absensi sedang dinonaktifkan oleh Owner.');
      return;
    }
    const authResult = DBStorage.authenticateUser(selectedStaff.id, pinInput);
    if (!authResult.success) {
      alert(authResult.message);
      setPinInput('');
      return;
    }
    if (profile.requireSelfiePhoto && !selfiePreview) {
      alert('Ambil foto selfie terbaru sebelum menyimpan absensi.');
      return;
    }
    const gpsValidated = await verifyGps();
    if (profile.requireGpsActive && !gpsValidated) {
      alert('Absensi ditolak karena lokasi belum terverifikasi.');
      return;
    }

    const now = new Date();
    const scheduledStart = getScheduledStart();
    const [hour, minute] = scheduledStart.split(':').map(Number);
    const scheduledDate = new Date(now);
    scheduledDate.setHours(hour, minute, 0, 0);
    const minutesLate = clockType === 'CLOCK_IN' ? Math.max(0, Math.floor((now.getTime() - scheduledDate.getTime()) / 60_000)) : 0;
    const tolerance = profile.latenessToleranceMinutes || 0;

    const record: AttendanceRecord = {
      id: 'att-' + Date.now().toString().slice(-4),
      staffId: selectedStaff.id,
      staffName: selectedStaff.name,
      role: selectedStaff.role,
      type: clockType,
      timestamp: new Date().toISOString(),
      location: currentBranch.name,
      photoUrl: selfiePreview || selectedStaff.avatar,
      status: minutesLate > tolerance ? 'LATE' : 'ON_TIME',
      branchId: currentBranch.id,
      branchName: currentBranch.name,
      scheduledStart,
      minutesLate,
      verificationMethod: profile.requireSelfiePhoto ? 'PIN_GPS_SELFIE' : profile.requireGpsActive ? 'PIN_GPS' : 'PIN',
      gpsValidated,
      selfieValidated: !!selfiePreview
    };

    onSaveAttendance(record);
    setPinInput('');
    setSelfiePreview('');
    alert(`Presensi ${clockType === 'CLOCK_IN' ? 'MASUK' : 'KELUAR'} Berhasil disimpan untuk ${selectedStaff.name}!`);
  };

  return (
    <div className="flex-1 bg-slate-100/70 p-4 md:p-6 overflow-y-auto font-sans select-none flex flex-col justify-between">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1714] tracking-tight flex items-center gap-2">
            <UserCheck className="w-7 h-7 text-blue-600" />
            Absensi Presensi Karyawan
          </h1>
          <p className="text-xs text-[#9C9590] font-bold mt-1">
            Sistem absensi digital terlindungi PIN, verifikasi GPS lokasi, dan foto selfie kasir/staf.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Clock In/Out Card Form */}
        <div className="bg-white rounded-2xl p-6 border border-[#E8E0D8]/80 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="font-bold text-[#1A1714] text-base mb-4">Form Presensi Staff</h2>

            <div className={`p-3 rounded-2xl mb-4 border ${profile.isAttendanceEnabled !== false ? 'bg-[#FFF7F3] border-[#F1C7B5]' : 'bg-[#F3F3F3] border-[#DDDDDD]'}`}>
              <p className="text-[10px] font-bold text-[#8A8A8A] uppercase tracking-wider">Aksi Berikutnya</p>
              <p className="text-sm font-bold text-[#1A1714] mt-0.5">{clockType === 'CLOCK_IN' ? 'CLOCK IN • Mulai Kerja' : 'CLOCK OUT • Selesai Kerja'}</p>
              <p className="text-[10px] text-[#777777] mt-1">Jadwal {getScheduledStart()}–{selectedStaff.shiftEnd || '-'} • Toleransi {profile.latenessToleranceMinutes || 0} menit</p>
            </div>

            {/* Select Staff */}
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-[#B8B0A8] uppercase tracking-wider block mb-1">Pilih Staff:</label>
                <select
                  value={selectedStaff.id}
                  onChange={(e) => {
                    const st = eligibleStaff.find((s) => s.id === e.target.value);
                    if (st) setSelectedStaff(st);
                  }}
                  className="w-full bg-[#FAFAF8] border border-[#E8E0D8] rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none"
                >
                  {eligibleStaff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Photo Preview Simulator */}
              <div className="bg-[#FAFAF8] border border-[#E8E0D8] rounded-2xl p-4 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#F05A1F] mb-1">
                  <img src={selfiePreview || selectedStaff.avatar} alt={selectedStaff.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex items-center gap-1 text-[11px] font-bold text-[#777777]">
                  <MapPin className="w-3 h-3 text-[#F05A1F]" />
                  <span>{currentBranch.name}</span>
                </div>
                <p className="text-[9px] text-[#9A9A9A] mt-1">{gpsMessage}</p>
                <label className="mt-2 px-3 py-1.5 bg-[#1C1B19] text-white text-[10px] font-bold rounded-xl flex items-center gap-1.5 cursor-pointer">
                  <Camera className="w-3 h-3" /> {selfiePreview ? 'Foto Ulang' : 'Ambil Selfie'}
                  <input
                    type="file"
                    accept="image/*"
                    capture="user"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => setSelfiePreview(String(reader.result || ''));
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              </div>

              {/* PIN Input */}
              <div>
                <label className="text-[10px] font-bold text-[#B8B0A8] uppercase tracking-wider block mb-1">Masukkan PIN Staff:</label>
                <input
                  type="password"
                  maxLength={4}
                  placeholder="****"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="w-full bg-[#FAFAF8] border border-[#E8E0D8] rounded-2xl px-3.5 py-2.5 text-center text-lg font-bold tracking-widest text-slate-800 outline-none focus:border-blue-500"
                />
              </div>

              <button
                onClick={handleClockAction}
                disabled={profile.isAttendanceEnabled === false || eligibleStaff.length === 0}
                className="w-full py-3 bg-[#F05A1F] hover:bg-[#D94B15] active:scale-95 text-white font-bold text-xs rounded-2xl transition-all shadow-md shadow-orange-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {clockType === 'CLOCK_IN' ? 'VERIFIKASI & CLOCK IN' : 'VERIFIKASI & CLOCK OUT'}
              </button>
            </div>
          </div>
        </div>

        {/* Attendance History Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-[#E8E0D8]/80 shadow-xs">
          <h2 className="font-bold text-[#1A1714] text-base mb-4">Riwayat Presensi Karyawan Hari Ini</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {attendanceRecords.length === 0 ? (
              <p className="text-xs text-[#B8B0A8] font-bold py-12 text-center">Belum ada riwayat presensi recorded hari ini</p>
            ) : (
              attendanceRecords.map((att) => (
                <div key={att.id} className="p-3.5 bg-[#FAFAF8] rounded-2xl border border-[#E8E0D8]/80 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-[#E8E0D8]">
                      <img src={att.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'} alt={att.staffName} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <p className="font-semibold text-xs text-[#1A1714]">{att.staffName} <span className="text-[10px] text-blue-600 font-bold">({att.role})</span></p>
                      <p className="text-[10px] text-[#8E8E8E] font-semibold">{att.location} • Jadwal {att.scheduledStart || '-'}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                      att.type === 'CLOCK_IN' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {att.type === 'CLOCK_IN' ? 'CLOCK IN' : 'CLOCK OUT'}
                    </span>
                    <p className="text-xs font-mono font-bold text-[#6B6560] mt-1">
                      {new Date(att.timestamp).toLocaleTimeString('id-ID')}
                    </p>
                    {att.status === 'LATE' && <p className="text-[9px] font-bold text-rose-600">Terlambat {att.minutesLate || 0} menit</p>}
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
