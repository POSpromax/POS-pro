import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CalendarDays, ChevronRight, Clock3, FileCheck2, History, MessageCircle, Minus,
  Paperclip, Plus, Save, Send, Settings2, UserRoundSearch, Users, WalletCards, X,
} from 'lucide-react';
import type { AttendanceRecord, Branch, UserAccount } from '../../types/pos';
import { uploadImage } from '../../services/cloudinaryMedia';
import { cloudReadiness } from '../../lib/runtimeEnv';
import {
  buildWhatsAppSlipUrl,
  calculatePayslip,
  finalizePayrollPeriod,
  loadHrData,
  lockPayrollPeriod,
  markPayrollPaid,
  requestKasbon,
  reviewKasbon,
  reviewLeave,
  savePayrollProfile,
  saveHrConfig,
  savePayrollAdjustment,
  submitLeave,
  type HrData,
  type HrConfig,
  type KasbonRecord,
  type PayrollProfile,
} from '../../services/hrService';

interface Props {
  activeUser: UserAccount;
  staffAccounts: UserAccount[];
  currentBranch: Branch;
  attendanceRecords: AttendanceRecord[];
  terminalMode: boolean;
  onShowToast: (title: string, message: string) => void;
  initialTab?: 'HISTORY' | 'LEAVE' | 'PAYROLL';
}

const MANAGEMENT = ['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN'];
const money = (value: number) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

// Status kinerja (reward otomatis) dari KPI kehadiran. Dipakai badge di report.
const performanceStatus = (present: number, attendanceRate: number, punctuality: number, absent: number): { label: string; tone: string } => {
  if (present === 0) return { label: 'Belum Ada Presensi', tone: 'bg-slate-100 text-slate-500' };
  if (absent === 0 && attendanceRate >= 95 && punctuality >= 95) return { label: 'Teladan', tone: 'bg-emerald-100 text-emerald-700' };
  if (attendanceRate >= 85 && punctuality >= 80) return { label: 'Baik', tone: 'bg-sky-100 text-sky-700' };
  if (attendanceRate >= 70) return { label: 'Cukup', tone: 'bg-amber-100 text-amber-700' };
  return { label: 'Perlu Perhatian', tone: 'bg-rose-100 text-rose-700' };
};
const DEFAULT_HR_CONFIG: HrConfig = {
  leaveReasons: [
    { code: 'SICK', label: 'Sakit', enabled: true, paid: true },
    { code: 'PERMIT', label: 'Izin pribadi', enabled: true, paid: true },
    { code: 'ANNUAL', label: 'Cuti tahunan', enabled: true, paid: true },
    { code: 'UNPAID', label: 'Izin tanpa dibayar', enabled: true, paid: false },
  ],
  latePenaltyGraceMinutes: 0,
  latePenaltyTiers: [
    { maxMinutes: 15, amount: 0 },
    { maxMinutes: 30, amount: 0 },
    { maxMinutes: 60, amount: 0 },
  ],
  overtimeMinMinutes: 30,
  workingDays: [1, 2, 3, 4, 5, 6],
};

export function AttendanceHrPanel({ activeUser, staffAccounts, currentBranch, attendanceRecords, terminalMode, onShowToast, initialTab = 'HISTORY' }: Props) {
  const canManage = MANAGEMENT.includes(activeUser.role) && !terminalMode;
  const [tab, setTab] = useState<'HISTORY' | 'LEAVE' | 'PAYROLL'>(initialTab);
  const [data, setData] = useState<HrData>({ canManage, leaveRequests: [], payrollProfiles: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detailStaff, setDetailStaff] = useState<UserAccount | null>(null);
  const [leave, setLeave] = useState({ leaveType: 'SICK', startDate: '', endDate: '', reason: '' });
  const [attachment, setAttachment] = useState<File | null>(null);
  const [payrollStaff, setPayrollStaff] = useState<UserAccount | null>(null);
  const [payroll, setPayroll] = useState({ baseSalary: 0, mealAllowance: 0, transportAllowance: 0, overtimeHourlyRate: 0, lateDeductionPerMinute: 0 });
  const [attendanceRange, setAttendanceRange] = useState<'MONTH' | 'WEEK' | 'DATE'>('MONTH');
  const [attendanceMonth, setAttendanceMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [hrConfigDraft, setHrConfigDraft] = useState<HrConfig>(DEFAULT_HR_CONFIG);

  // ── Kasbon state ────────────────────────────────────────────────────────────
  const [kasbonStaff, setKasbonStaff]   = useState<UserAccount | null>(null);
  const [kasbonAmount, setKasbonAmount] = useState<number | ''>('');
  const [kasbonReason, setKasbonReason] = useState('');
  const [kasbonMonth, setKasbonMonth]   = useState<string>('');   // "YYYY-MM"

  // ── Payslip state ───────────────────────────────────────────────────────────
  const [slipStaff, setSlipStaff]       = useState<UserAccount | null>(null);
  const [historyStaff, setHistoryStaff] = useState<UserAccount | null>(null);
  // Konsolidasi kantor pusat: rekap seluruh cabang (BACA saja).
  const [scopeAll, setScopeAll] = useState(false);
  const [bonusDraft, setBonusDraft]     = useState<number | ''>('');
  const [savingBonus, setSavingBonus]   = useState(false);
  const [slipPeriod, setSlipPeriod]     = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const refresh = async () => {
    if (!cloudReadiness.supabase) return;
    setLoading(true);
    setError('');
    // Tanpa filter periode: memuat SELURUH snapshot payroll agar histori gaji
    // lintas bulan tersedia (jumlahnya kecil: beberapa staff × beberapa bulan).
    try { setData(await loadHrData(currentBranch.id, undefined, scopeAll ? 'ALL' : undefined)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Data HR gagal dimuat'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void refresh(); }, [currentBranch.id, activeUser.id, scopeAll]);
  useEffect(() => { setHrConfigDraft(data.hrConfig || DEFAULT_HR_CONFIG); }, [data.hrConfig]);
  useEffect(() => {
    if (!slipStaff) return;
    const adj = (data.payrollAdjustments || []).find((a) => a.user_id === slipStaff.id && a.period === slipPeriod);
    setBonusDraft(adj?.bonus || '');
  }, [slipStaff, slipPeriod, data.payrollAdjustments]);

  const saveBonus = async (staff: UserAccount) => {
    if (scopeAll) { onShowToast('Mode Konsolidasi', 'Pindah ke OUTLET INI untuk mengatur bonus.'); return; }
    setSavingBonus(true);
    try {
      await savePayrollAdjustment({ branchId: currentBranch.id, userId: staff.id, period: slipPeriod, bonus: Number(bonusDraft) || 0 });
      await refresh();
      onShowToast('Bonus Disimpan', `Bonus ${staff.name} untuk ${slipPeriod} tersimpan. Untuk periode terfinalisasi, finalisasi ulang agar masuk snapshot.`);
    } catch (err) { onShowToast('Bonus Gagal', err instanceof Error ? err.message : 'Bonus tidak dapat disimpan.'); }
    finally { setSavingBonus(false); }
  };

  // Editor tingkat penalty telat (branch_hr_config.latePenaltyTiers).
  const defaultTiers = DEFAULT_HR_CONFIG.latePenaltyTiers || [];
  const tiersDraft = hrConfigDraft.latePenaltyTiers?.length ? hrConfigDraft.latePenaltyTiers : defaultTiers;
  const baseTiers = () => (hrConfigDraft.latePenaltyTiers?.length ? hrConfigDraft.latePenaltyTiers : defaultTiers);
  const updateTier = (i: number, patch: Partial<{ maxMinutes: number; amount: number }>) =>
    setHrConfigDraft((c) => ({ ...c, latePenaltyTiers: baseTiers().map((t, idx) => (idx === i ? { ...t, ...patch } : t)) }));
  const addTier = () =>
    setHrConfigDraft((c) => {
      const base = baseTiers();
      return { ...c, latePenaltyTiers: [...base, { maxMinutes: (base[base.length - 1]?.maxMinutes || 0) + 30, amount: 0 }].slice(0, 6) };
    });
  const removeTier = (i: number) =>
    setHrConfigDraft((c) => {
      const base = baseTiers();
      return { ...c, latePenaltyTiers: base.length > 1 ? base.filter((_, idx) => idx !== i) : base };
    });

  const branchStaff = useMemo(() => staffAccounts.filter((staff) => staff.isActive !== false && staff.role !== 'OWNER' && staff.role !== 'SUPER_OWNER' && (!staff.branchIds?.length || staff.branchIds.includes(currentBranch.id))), [staffAccounts, currentBranch.id]);
  const recordsByStaff = useMemo(() => new Map(branchStaff.map((staff) => [staff.id, attendanceRecords.filter((record) => record.staffId === staff.id)])), [branchStaff, attendanceRecords]);

  const visibleStaff = canManage ? branchStaff : branchStaff.filter((staff) => staff.id === activeUser.id);
  const rangeRecords = useMemo(() => {
    const selected = new Date(`${attendanceDate}T00:00:00`);
    const weekStart = new Date(selected);
    weekStart.setDate(selected.getDate() - ((selected.getDay() + 6) % 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    return attendanceRecords.filter((record) => {
      const date = new Date(record.timestamp);
      if (attendanceRange === 'MONTH') return record.timestamp.slice(0, 7) === attendanceMonth;
      if (attendanceRange === 'DATE') return record.timestamp.slice(0, 10) === attendanceDate;
      return date >= weekStart && date < weekEnd;
    });
  }, [attendanceDate, attendanceMonth, attendanceRange, attendanceRecords]);

  const monitoring = useMemo(() => ({
    staff: visibleStaff.length,
    present: new Set(rangeRecords.filter((record) => record.type === 'CLOCK_IN').map((record) => record.staffId)).size,
    late: rangeRecords.filter((record) => record.type === 'CLOCK_IN' && record.status === 'LATE').length,
    lateMinutes: rangeRecords.filter((record) => record.type === 'CLOCK_IN' && record.status === 'LATE').reduce((sum, record) => sum + (record.minutesLate || 0), 0),
    pendingLeave: data.leaveRequests.filter((request) => request.status === 'PENDING').length,
  }), [data.leaveRequests, rangeRecords, visibleStaff.length]);

  const matrixDays = useMemo(() => {
    const [year, month] = attendanceMonth.split('-').map(Number);
    return Array.from({ length: new Date(year, month, 0).getDate() }, (_, index) => index + 1);
  }, [attendanceMonth]);

  // ── Status harian & KPI ──────────────────────────────────────────────────────
  const todayKey = new Date().toISOString().slice(0, 10);
  // Tanggal sistem mulai melacak presensi di outlet ini (record paling awal).
  // Hari sebelum ini tidak boleh dihitung Alpha — sistem belum dipakai.
  const trackingStart = useMemo(
    () => (attendanceRecords.length
      ? attendanceRecords.reduce((min, r) => (r.timestamp.slice(0, 10) < min ? r.timestamp.slice(0, 10) : min), '9999-12-31')
      : todayKey),
    [attendanceRecords, todayKey],
  );
  const approvedLeaves = useMemo(() => data.leaveRequests.filter((r) => r.status === 'APPROVED'), [data.leaveRequests]);
  const workingDaysConfig = data.hrConfig?.workingDays?.length ? data.hrConfig.workingDays : DEFAULT_HR_CONFIG.workingDays;
  const workDaysFor = (staff: UserAccount): number[] =>
    (Array.isArray(staff.workDays) && staff.workDays.length ? staff.workDays : workingDaysConfig);
  const leaveOn = (staffId: string, dateKey: string) =>
    approvedLeaves.find((r) => r.user_id === staffId && r.start_date <= dateKey && dateKey <= r.end_date);

  type DayCode = 'PRESENT' | 'LATE' | 'OPEN' | 'LEAVE' | 'OFF' | 'ABSENT' | 'UPCOMING';
  const dayStatus = (staff: UserAccount, dateKey: string): {
    code: DayCode; minutesLate: number; workMinutes: number; clockInMin: number | null; leaveType?: string;
  } => {
    const records = (recordsByStaff.get(staff.id) || []).filter((r) => r.timestamp.slice(0, 10) === dateKey);
    const clockIn = records.find((r) => r.type === 'CLOCK_IN');
    const clockOut = records.slice().reverse().find((r) => r.type === 'CLOCK_OUT');
    if (clockIn) {
      const inDate = new Date(clockIn.timestamp);
      const clockInMin = inDate.getHours() * 60 + inDate.getMinutes();
      const workMinutes = clockOut ? Math.max(0, Math.round((+new Date(clockOut.timestamp) - +new Date(clockIn.timestamp)) / 60000)) : 0;
      if (clockIn.status === 'LATE') return { code: 'LATE', minutesLate: clockIn.minutesLate || 0, workMinutes, clockInMin };
      if (!clockOut) return { code: 'OPEN', minutesLate: 0, workMinutes: 0, clockInMin };
      return { code: 'PRESENT', minutesLate: 0, workMinutes, clockInMin };
    }
    const leave = leaveOn(staff.id, dateKey);
    if (leave) return { code: 'LEAVE', minutesLate: 0, workMinutes: 0, clockInMin: null, leaveType: leave.leave_type };
    const dow = new Date(`${dateKey}T00:00:00`).getDay();
    if (!workDaysFor(staff).includes(dow)) return { code: 'OFF', minutesLate: 0, workMinutes: 0, clockInMin: null };
    if (dateKey >= todayKey) return { code: 'UPCOMING', minutesLate: 0, workMinutes: 0, clockInMin: null };
    // Sebelum sistem melacak / sebelum staff bergabung: bukan Alpha (netral).
    const joinKey = staff.joinDate ? String(staff.joinDate).slice(0, 10) : '';
    if (dateKey < trackingStart || (joinKey && dateKey < joinKey)) return { code: 'UPCOMING', minutesLate: 0, workMinutes: 0, clockInMin: null };
    return { code: 'ABSENT', minutesLate: 0, workMinutes: 0, clockInMin: null };
  };

  const CELL_STYLE: Record<DayCode, { label: string; tone: string; title: string }> = {
    PRESENT: { label: 'H', tone: 'bg-emerald-100 text-emerald-700', title: 'Hadir lengkap' },
    LATE: { label: 'T', tone: 'bg-amber-100 text-amber-700', title: 'Terlambat' },
    OPEN: { label: 'IN', tone: 'bg-sky-100 text-sky-700', title: 'Sudah masuk, belum clock out' },
    LEAVE: { label: 'I', tone: 'bg-violet-100 text-violet-700', title: 'Izin/Cuti/Sakit (disetujui)' },
    OFF: { label: 'L', tone: 'bg-slate-100 text-slate-400', title: 'Hari libur' },
    ABSENT: { label: 'A', tone: 'bg-rose-100 text-rose-700', title: 'Alpha / tanpa keterangan' },
    UPCOMING: { label: '·', tone: 'bg-slate-50 text-slate-300', title: 'Belum berjalan' },
  };
  const matrixCell = (staffId: string, day: number) => {
    const staff = branchStaff.find((s) => s.id === staffId);
    if (!staff) return CELL_STYLE.UPCOMING;
    const status = dayStatus(staff, `${attendanceMonth}-${String(day).padStart(2, '0')}`);
    const base = CELL_STYLE[status.code];
    if (status.code === 'LATE') return { ...base, title: `Terlambat ${status.minutesLate} menit` };
    if (status.code === 'LEAVE') return { ...base, title: `${status.leaveType || 'Izin'} (disetujui)` };
    return base;
  };

  const fmtMinOfDay = (m: number | null) => (m == null ? '—' : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);

  // KPI kehadiran per staff untuk bulan matriks (attendanceMonth).
  const staffKpis = useMemo(() => visibleStaff.map((staff) => {
    let onTime = 0, late = 0, leaveDays = 0, absent = 0, offDays = 0, lateMinutes = 0, workMinutes = 0;
    const clockInMins: number[] = [];
    matrixDays.forEach((day) => {
      const s = dayStatus(staff, `${attendanceMonth}-${String(day).padStart(2, '0')}`);
      if (s.code === 'PRESENT') { onTime++; workMinutes += s.workMinutes; if (s.clockInMin != null) clockInMins.push(s.clockInMin); }
      else if (s.code === 'LATE') { late++; lateMinutes += s.minutesLate; workMinutes += s.workMinutes; if (s.clockInMin != null) clockInMins.push(s.clockInMin); }
      else if (s.code === 'OPEN') { onTime++; if (s.clockInMin != null) clockInMins.push(s.clockInMin); }
      else if (s.code === 'LEAVE') leaveDays++;
      else if (s.code === 'ABSENT') absent++;
      else if (s.code === 'OFF') offDays++;
    });
    const present = onTime + late;
    const expected = present + absent; // hari kerja terlewat yang seharusnya hadir (izin dikecualikan)
    const attendanceRate = expected > 0 ? Math.round((present / expected) * 100) : 100;
    const punctuality = present > 0 ? Math.round((onTime / present) * 100) : 100;
    const avgClockIn = clockInMins.length ? Math.round(clockInMins.reduce((a, b) => a + b, 0) / clockInMins.length) : null;
    const status = performanceStatus(present, attendanceRate, punctuality, absent);
    return { staff, onTime, late, present, leaveDays, absent, offDays, lateMinutes, workHours: workMinutes / 60, attendanceRate, punctuality, avgClockIn, status };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [visibleStaff, matrixDays, attendanceMonth, recordsByStaff, approvedLeaves, data.hrConfig, todayKey]);

  const saveHrPolicy = async () => {
    if (scopeAll) { onShowToast('Mode Konsolidasi', 'Pindah ke OUTLET INI untuk mengubah kebijakan HR.'); return; }
    setLoading(true);
    try {
      await saveHrConfig({ branchId: currentBranch.id, ...hrConfigDraft });
      await refresh();
      onShowToast('Kebijakan HR Disimpan', 'Alasan izin, hari kerja, dan toleransi telat diperbarui untuk outlet ini.');
    } catch (err) { onShowToast('Konfigurasi Gagal', err instanceof Error ? err.message : 'Kebijakan HR tidak dapat disimpan.'); }
    finally { setLoading(false); }
  };

  const sendLeave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!leave.startDate || !leave.endDate || leave.reason.trim().length < 5) {
      onShowToast('Data Belum Lengkap', 'Pilih rentang tanggal dan isi keterangan minimal 5 karakter.');
      return;
    }
    setLoading(true);
    try {
      let media: { publicId?: string; secureUrl?: string } = {};
      if (attachment) media = await uploadImage(attachment, 'leave', currentBranch.id);
      await submitLeave({ branchId: currentBranch.id, ...leave, attachmentPublicId: media.publicId, attachmentUrl: media.secureUrl });
      setLeave({ leaveType: 'SICK', startDate: '', endDate: '', reason: '' });
      setAttachment(null);
      await refresh();
      onShowToast('Pengajuan Terkirim', 'Izin masuk ke antrean persetujuan manajemen.');
    } catch (err) { onShowToast('Pengajuan Gagal', err instanceof Error ? err.message : 'Izin tidak dapat disimpan.'); }
    finally { setLoading(false); }
  };

  const decideLeave = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    setLoading(true);
    try {
      await reviewLeave({ branchId: currentBranch.id, requestId: id, status });
      await refresh();
      onShowToast('Status Diperbarui', status === 'APPROVED' ? 'Izin disetujui.' : 'Izin ditolak.');
    } catch (err) { onShowToast('Tinjauan Gagal', err instanceof Error ? err.message : 'Status tidak dapat diperbarui.'); }
    finally { setLoading(false); }
  };

  const openPayroll = (staff: UserAccount) => {
    const saved = data.payrollProfiles.find((item) => item.user_id === staff.id);
    setPayrollStaff(staff);
    setPayroll({
      baseSalary: saved?.base_salary || 0,
      mealAllowance: saved?.meal_allowance || 0,
      transportAllowance: saved?.transport_allowance || 0,
      overtimeHourlyRate: saved?.overtime_hourly_rate || 0,
      lateDeductionPerMinute: saved?.late_deduction_per_minute || 0,
    });
  };

  const savePayroll = async () => {
    if (scopeAll) { onShowToast('Mode Konsolidasi', 'Pindah ke OUTLET INI untuk mengubah komponen payroll.'); return; }
    if (!payrollStaff) return;
    setLoading(true);
    try {
      await savePayrollProfile({ branchId: currentBranch.id, userId: payrollStaff.id, ...payroll });
      setPayrollStaff(null);
      await refresh();
      onShowToast('Payroll Disimpan', `Komponen payroll ${payrollStaff.name} diperbarui.`);
    } catch (err) { onShowToast('Payroll Gagal', err instanceof Error ? err.message : 'Payroll tidak dapat disimpan.'); }
    finally { setLoading(false); }
  };

  // ── Kasbon helpers ──────────────────────────────────────────────────────────

  const openKasbon = (staff: UserAccount) => {
    setKasbonStaff(staff);
    setKasbonAmount('');
    setKasbonReason('');
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    setKasbonMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
  };

  const submitKasbon = async () => {
    if (scopeAll) { onShowToast('Mode Konsolidasi', 'Pindah ke OUTLET INI untuk mencatat kasbon.'); return; }
    if (!kasbonStaff || !kasbonAmount || Number(kasbonAmount) <= 0) {
      onShowToast('Data Tidak Lengkap', 'Isi nominal kasbon dan alasan.');
      return;
    }
    const profile = data.payrollProfiles.find((p) => p.user_id === kasbonStaff.id);
    if (profile?.base_salary && Number(kasbonAmount) > profile.base_salary * 0.5) {
      onShowToast('Melebihi Batas Kasbon', `Maksimal kasbon adalah Rp ${Math.round(profile.base_salary * 0.5).toLocaleString('id-ID')} (50% dari gaji pokok).`);
      return;
    }
    setLoading(true);
    try {
      await requestKasbon({
        branchId: currentBranch.id,
        userId: kasbonStaff.id,
        amount: Number(kasbonAmount),
        reason: kasbonReason.trim() || 'Kasbon',
        deductMonth: kasbonMonth,
      });
      setKasbonStaff(null);
      await refresh();
      onShowToast('Kasbon Diajukan', `Kasbon ${kasbonStaff.name} masuk antrean persetujuan.`);
    } catch (err) { onShowToast('Kasbon Gagal', err instanceof Error ? err.message : 'Kasbon tidak dapat disimpan.'); }
    finally { setLoading(false); }
  };

  const approveKasbon = async (kasbon: KasbonRecord, status: 'APPROVED' | 'REJECTED') => {
    setLoading(true);
    try {
      await reviewKasbon({ branchId: currentBranch.id, kasbonId: kasbon.id, status });
      await refresh();
      onShowToast(status === 'APPROVED' ? 'Kasbon Disetujui' : 'Kasbon Ditolak', kasbon.staffName);
    } catch (err) { onShowToast('Gagal', err instanceof Error ? err.message : 'Operasi kasbon gagal.'); }
    finally { setLoading(false); }
  };

  // ── Payslip helpers ─────────────────────────────────────────────────────────

  const buildSlip = (staff: UserAccount, period: string) => {
    const snapshot = (data.payrollSnapshots || []).find((item) => item.user_id === staff.id && item.period === period);
    if (snapshot) {
      const [yr, mo] = period.split('-').map(Number);
      return {
        staffId: staff.id,
        staffName: snapshot.staff_name || staff.name,
        phone: staff.phone,
        period,
        periodLabel: new Date(yr, mo - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
        baseSalary: Number(snapshot.base_salary || 0),
        mealAllowance: Number(snapshot.meal_allowance || 0),
        transportAllowance: Number(snapshot.transport_allowance || 0),
        overtimeMinutes: Number(snapshot.overtime_minutes || 0),
        overtimePay: Number(snapshot.overtime_pay || 0),
        grossSalary: Number(snapshot.gross_salary || 0),
        bonus: Number(snapshot.manual_adjustment || 0),
        lateDeduction: Number(snapshot.late_deduction || 0),
        kasbonDeduction: Number(snapshot.kasbon_deduction || 0),
        totalDeduction: Number(snapshot.total_deduction || 0),
        netSalary: Number(snapshot.net_salary || 0),
        lateMinutes: Number(snapshot.late_minutes || 0),
        attendanceCount: Number(snapshot.attendance_count || 0),
        notes: 'Snapshot payroll tersimpan',
      };
    }
    const profile = data.payrollProfiles.find((p) => p.user_id === staff.id);
    if (!profile) return null;

    // Hitung menit terlambat dari attendance bulan terpilih
    const [yr, mo] = period.split('-').map(Number);
    const staffRecords = (recordsByStaff.get(staff.id) || []).filter((r) => {
      const d = new Date(r.timestamp);
      return d.getFullYear() === yr && d.getMonth() + 1 === mo;
    });
    const grace = data.hrConfig?.latePenaltyGraceMinutes || 0;
    const lateMinutes = staffRecords
      .filter((r) => r.type === 'CLOCK_IN' && r.status === 'LATE')
      .reduce((s, r) => s + Math.max(0, (r.minutesLate || 0) - grace), 0);
    const attendanceCount = staffRecords.filter((r) => r.type === 'CLOCK_IN').length;

    // Kasbon yang dipotong bulan ini
    const kasbonDeduction = (data.kasbonRecords || [])
      .filter((k) => k.user_id === staff.id && k.deduct_month === period && k.status === 'APPROVED')
      .reduce((s, k) => s + k.amount, 0);

    // Bonus manual periode ini (reward)
    const bonus = (data.payrollAdjustments || [])
      .find((a) => a.user_id === staff.id && a.period === period)?.bonus || 0;

    return calculatePayslip({
      profile,
      staffId: staff.id,
      staffName: staff.name,
      phone: staff.phone,
      period,
      lateMinutes,
      attendanceCount,
      kasbonDeduction,
      bonus,
      overtimeMinutes: 0,
      overtimePay: 0,
      notes: 'Draft: lembur & penalty bertingkat dihitung akurat saat periode difinalisasi',
    });
  };

  const payrollPeriod = (data.payrollPeriods || []).find((item) => item.period === slipPeriod);
  const payrollPeriodStatus = payrollPeriod?.status || 'DRAFT';

  const finalizePeriod = async () => {
    if (scopeAll) { onShowToast('Mode Konsolidasi', 'Finalisasi payroll dilakukan per cabang. Pindah ke OUTLET INI.'); return; }
    if (!window.confirm(`Finalisasi payroll ${slipPeriod}? Snapshot gaji akan dihitung dari data absensi dan kasbon saat ini.`)) return;
    setLoading(true);
    try {
      await finalizePayrollPeriod({ branchId: currentBranch.id, period: slipPeriod });
      await refresh();
      onShowToast('Payroll Difinalisasi', `Snapshot payroll ${slipPeriod} sudah dibuat.`);
    } catch (err) { onShowToast('Finalisasi Gagal', err instanceof Error ? err.message : 'Payroll tidak dapat difinalisasi.'); }
    finally { setLoading(false); }
  };

  const markPeriodPaid = async () => {
    if (!window.confirm(`Tandai payroll ${slipPeriod} sudah dibayar? Kasbon periode ini akan ditandai sudah dipotong.`)) return;
    setLoading(true);
    try {
      await markPayrollPaid({ branchId: currentBranch.id, period: slipPeriod });
      await refresh();
      onShowToast('Payroll Dibayar', `Periode ${slipPeriod} ditandai PAID.`);
    } catch (err) { onShowToast('Update Gagal', err instanceof Error ? err.message : 'Status payroll tidak dapat diperbarui.'); }
    finally { setLoading(false); }
  };

  const lockPeriod = async () => {
    if (!window.confirm(`Kunci payroll ${slipPeriod}? Setelah dikunci snapshot tidak boleh dihitung ulang.`)) return;
    setLoading(true);
    try {
      await lockPayrollPeriod({ branchId: currentBranch.id, period: slipPeriod });
      await refresh();
      onShowToast('Payroll Dikunci', `Periode ${slipPeriod} sudah LOCKED dan menjadi histori tetap.`);
    } catch (err) { onShowToast('Penguncian Gagal', err instanceof Error ? err.message : 'Payroll tidak dapat dikunci.'); }
    finally { setLoading(false); }
  };

  const visibleLeaves = canManage ? data.leaveRequests : data.leaveRequests.filter((item) => item.user_id === activeUser.id);
  const detailRecords = detailStaff ? (recordsByStaff.get(detailStaff.id) || []).slice().sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp)) : [];

  return (
    <section className="mt-6 rounded-2xl border border-[var(--panel-border)] bg-white p-4 shadow-sm md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-bold text-[var(--text-primary)]">Kehadiran & HR</h2><p className="text-xs font-semibold text-slate-500">Riwayat, izin, dan komponen payroll terhubung per outlet.</p></div>
                {canManage && (
          <div className="flex rounded-2xl bg-[var(--surface-secondary)] p-1 text-[11px] font-bold">
            <button type="button" onClick={() => setScopeAll(false)} className={`rounded-xl px-3 py-2 ${!scopeAll ? 'bg-[var(--primary)] text-white' : 'text-slate-500'}`}>OUTLET INI</button>
            <button type="button" onClick={() => setScopeAll(true)} className={`rounded-xl px-3 py-2 ${scopeAll ? 'bg-[var(--primary)] text-white' : 'text-slate-500'}`}>SEMUA CABANG</button>
          </div>
        )}
        <div className="flex rounded-2xl bg-[var(--surface-secondary)] p-1 text-[11px] font-bold">
          <button onClick={() => setTab('HISTORY')} className={`rounded-xl px-3 py-2 ${tab === 'HISTORY' ? 'bg-[var(--primary)] text-white' : 'text-slate-500'}`}>DETAIL ABSEN</button>
          <button onClick={() => setTab('LEAVE')} className={`rounded-xl px-3 py-2 ${tab === 'LEAVE' ? 'bg-[var(--primary)] text-white' : 'text-slate-500'}`}>AJUKAN IZIN</button>
          {canManage && <button onClick={() => setTab('PAYROLL')} className={`rounded-xl px-3 py-2 ${tab === 'PAYROLL' ? 'bg-[var(--primary)] text-white' : 'text-slate-500'}`}>PAYROLL</button>}
        </div>
      </div>
      {error && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">{error}</div>}

      {tab === 'HISTORY' && <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-card)] p-4">
          <div><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Periode monitoring</p><h3 className="mt-1 text-sm font-bold">Matriks Kehadiran Outlet</h3></div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl bg-slate-100 p-1 text-[10px] font-bold">
              {(['MONTH', 'WEEK', 'DATE'] as const).map((range) => <button key={range} type="button" onClick={() => setAttendanceRange(range)} className={`rounded-lg px-3 py-2 ${attendanceRange === range ? 'bg-white text-[var(--primary-hover)] shadow-sm' : 'text-slate-400'}`}>{range === 'MONTH' ? 'Bulan' : range === 'WEEK' ? 'Minggu' : 'Tanggal'}</button>)}
            </div>
            {attendanceRange === 'MONTH'
              ? <input type="month" value={attendanceMonth} onChange={(event) => setAttendanceMonth(event.target.value)} className="ui-input w-auto text-xs" />
              : <input type="date" value={attendanceDate} onChange={(event) => setAttendanceDate(event.target.value)} className="ui-input w-auto text-xs" />}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: 'Staff aktif', value: monitoring.staff, icon: Users, tone: 'bg-emerald-50 text-emerald-700' },
            { label: 'Hadir periode', value: monitoring.present, icon: CalendarDays, tone: 'bg-sky-50 text-sky-700' },
            { label: 'Kejadian telat', value: monitoring.late, icon: Clock3, tone: 'bg-amber-50 text-amber-700' },
            { label: 'Total menit telat', value: monitoring.lateMinutes, icon: Clock3, tone: 'bg-orange-50 text-orange-700' },
            { label: 'Izin menunggu', value: monitoring.pendingLeave, icon: AlertTriangle, tone: 'bg-rose-50 text-rose-700' },
          ].map((metric) => <div key={metric.label} className="rounded-2xl border border-[var(--panel-border)] bg-white p-4"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${metric.tone}`}><metric.icon className="h-4 w-4" /></div><p className="mt-4 text-2xl font-black tabular-nums">{metric.value}</p><p className="mt-1 text-[10px] font-black uppercase tracking-wider text-slate-400">{metric.label}</p></div>)}
        </div>

        {attendanceRange === 'MONTH' && <div className="overflow-hidden rounded-2xl border border-[var(--panel-border)] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--panel-border)] p-4"><div><h3 className="text-sm font-bold">Matriks 1 Bulan</h3><p className="mt-1 text-[10px] font-semibold text-slate-400 flex flex-wrap gap-x-2.5 gap-y-1"><span><b className="text-emerald-600">H</b> Hadir</span><span><b className="text-amber-600">T</b> Telat</span><span><b className="text-sky-600">IN</b> Belum clock-out</span><span><b className="text-violet-600">I</b> Izin/Cuti/Sakit</span><span><b className="text-slate-400">L</b> Libur</span><span><b className="text-rose-600">A</b> Alpha</span></p></div><span className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-bold text-slate-500">{attendanceMonth}</span></div>
          <div className="overflow-x-auto">
            <table className="min-w-max border-collapse text-[10px]">
              <thead><tr className="bg-slate-50"><th className="sticky left-0 z-10 min-w-44 border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left font-black">Karyawan</th>{matrixDays.map((day) => <th key={day} className="h-9 w-9 border-b border-slate-200 text-center font-black text-slate-400">{day}</th>)}</tr></thead>
              <tbody>{visibleStaff.map((staff) => <tr key={staff.id} className="border-b border-slate-100 last:border-0"><td className="sticky left-0 z-10 border-r border-slate-200 bg-white px-3 py-2"><button type="button" onClick={() => setDetailStaff(staff)} className="text-left"><span className="block max-w-36 truncate font-black">{staff.name}</span><span className="text-[9px] font-bold text-slate-400">{staff.role}</span></button></td>{matrixDays.map((day) => { const cell = matrixCell(staff.id, day); return <td key={day} className="p-1 text-center"><span title={cell.title} className={`flex h-7 min-w-7 items-center justify-center rounded-lg font-black ${cell.tone}`}>{cell.label}</span></td>; })}</tr>)}</tbody>
            </table>
          </div>
        </div>}

        {/* ── Tabel KPI Kehadiran per Staff (bulan matriks) ── */}
        <div className="overflow-hidden rounded-2xl border border-[var(--panel-border)] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--panel-border)] p-4">
            <div>
              <h3 className="text-sm font-bold">KPI Kehadiran per Staff</h3>
              <p className="mt-1 text-[10px] font-semibold text-slate-400">Ringkasan kinerja kehadiran bulan {attendanceMonth}. Kehadiran% = hadir ÷ hari kerja terlewat (izin dikecualikan).</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-max border-collapse text-[11px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
              <thead>
                <tr className="bg-slate-50 text-[9px] font-black uppercase tracking-wider text-slate-400">
                  <th className="sticky left-0 z-10 min-w-40 border-b border-r border-slate-200 bg-slate-50 px-3 py-2.5 text-left">Karyawan</th>
                  <th className="border-b border-slate-200 px-3 py-2.5 text-center">Hadir</th>
                  <th className="border-b border-slate-200 px-3 py-2.5 text-center">Telat</th>
                  <th className="border-b border-slate-200 px-3 py-2.5 text-center">Izin</th>
                  <th className="border-b border-slate-200 px-3 py-2.5 text-center">Alpha</th>
                  <th className="border-b border-slate-200 px-3 py-2.5 text-center">Kehadiran</th>
                  <th className="border-b border-slate-200 px-3 py-2.5 text-center">Tepat Waktu</th>
                  <th className="border-b border-slate-200 px-3 py-2.5 text-center">Rata² Masuk</th>
                  <th className="border-b border-slate-200 px-3 py-2.5 text-center">Jam Kerja</th>
                  <th className="border-b border-slate-200 px-3 py-2.5 text-center">Menit Telat</th>
                  <th className="border-b border-slate-200 px-3 py-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {staffKpis.map((k) => {
                  const rateTone = k.attendanceRate >= 90 ? 'text-emerald-600' : k.attendanceRate >= 75 ? 'text-amber-600' : 'text-rose-600';
                  const punctTone = k.punctuality >= 90 ? 'text-emerald-600' : k.punctuality >= 75 ? 'text-amber-600' : 'text-rose-600';
                  return (
                    <tr key={k.staff.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                      <td className="sticky left-0 z-10 border-r border-slate-200 bg-white px-3 py-2">
                        <button type="button" onClick={() => setDetailStaff(k.staff)} className="text-left">
                          <span className="block max-w-36 truncate font-black text-[var(--text-primary)]">{k.staff.name}</span>
                          <span className="text-[9px] font-bold text-slate-400">{k.staff.role}</span>
                        </button>
                      </td>
                      <td className="px-3 py-2 text-center font-bold text-emerald-600">{k.onTime}</td>
                      <td className="px-3 py-2 text-center font-bold text-amber-600">{k.late}</td>
                      <td className="px-3 py-2 text-center font-bold text-violet-600">{k.leaveDays}</td>
                      <td className="px-3 py-2 text-center font-bold text-rose-600">{k.absent}</td>
                      <td className={`px-3 py-2 text-center font-black ${rateTone}`}>{k.attendanceRate}%</td>
                      <td className={`px-3 py-2 text-center font-black ${punctTone}`}>{k.punctuality}%</td>
                      <td className="px-3 py-2 text-center font-mono text-slate-600">{fmtMinOfDay(k.avgClockIn)}</td>
                      <td className="px-3 py-2 text-center font-mono text-slate-600">{k.workHours > 0 ? `${k.workHours.toFixed(1)} j` : '—'}</td>
                      <td className="px-3 py-2 text-center font-mono text-slate-600">{k.lateMinutes}</td>
                      <td className="px-3 py-2 text-center"><span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${k.status.tone}`}>{k.status.label}</span></td>
                    </tr>
                  );
                })}
                {staffKpis.length === 0 && <tr><td colSpan={11} className="p-6 text-center text-slate-400">Belum ada data staff.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleStaff.map((staff) => {
            const records = (recordsByStaff.get(staff.id) || []).filter((record) => rangeRecords.some((visible) => visible.id === record.id));
            const last = records.slice().sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp))[0];
            const kpi = staffKpis.find((k) => k.staff.id === staff.id);
            return <button key={staff.id} onClick={() => setDetailStaff(staff)} className="flex items-center gap-3 rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-card)] p-4 text-left transition hover:border-[var(--primary)] hover:bg-[var(--brand-100)]/40"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary)] font-bold text-white">{staff.name.slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><p className="truncate text-sm font-bold">{staff.name}</p>{kpi && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${kpi.status.tone}`}>{kpi.status.label}</span>}</div><p className="text-[11px] font-bold text-slate-400">{staff.role} · {records.filter((record) => record.type === 'CLOCK_IN').length} hari hadir</p><p className={`mt-1 truncate text-[11px] font-bold ${last ? 'text-[var(--primary-hover)]' : 'text-slate-400'}`}>{last ? `${last.type.replace('_', ' ')} · ${new Date(last.timestamp).toLocaleString('id-ID')}` : 'Belum ada presensi pada periode'}</p></div><ChevronRight className="h-4 w-4 text-slate-400" /></button>;
          })}
        </div>
      </div>}

      {tab === 'LEAVE' && <div className="grid gap-5 lg:grid-cols-[minmax(280px,420px)_1fr]">
        <form onSubmit={sendLeave} className="space-y-3 rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-card)] p-4">
          <div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-[var(--primary-hover)]"/><h3 className="text-sm font-bold">Pengajuan Izin Tidak Masuk</h3></div>
          <select value={leave.leaveType} onChange={(e) => setLeave({ ...leave, leaveType: e.target.value })} className="w-full rounded-xl border border-[var(--panel-border)] bg-white p-3 text-xs font-bold">{(data.hrConfig?.leaveReasons || DEFAULT_HR_CONFIG.leaveReasons).filter((reason) => reason.enabled).map((reason) => <option key={reason.code} value={reason.code}>{reason.label}{reason.paid ? '' : ' (tidak dibayar)'}</option>)}</select>
          <div className="grid grid-cols-2 gap-2"><label className="text-[11px] font-bold text-slate-500">MULAI<input type="date" value={leave.startDate} onChange={(e) => setLeave({ ...leave, startDate: e.target.value })} className="mt-1 w-full rounded-xl border border-[var(--panel-border)] bg-white p-3 text-xs"/></label><label className="text-[11px] font-bold text-slate-500">SAMPAI<input type="date" value={leave.endDate} min={leave.startDate} onChange={(e) => setLeave({ ...leave, endDate: e.target.value })} className="mt-1 w-full rounded-xl border border-[var(--panel-border)] bg-white p-3 text-xs"/></label></div>
          <textarea value={leave.reason} onChange={(e) => setLeave({ ...leave, reason: e.target.value })} maxLength={500} placeholder="Keterangan izin..." className="min-h-24 w-full rounded-xl border border-[var(--panel-border)] bg-white p-3 text-xs"/>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--brand-200)] bg-[var(--brand-50)] p-3 text-xs font-bold text-[var(--primary-text)]"><Paperclip className="h-4 w-4"/>{attachment ? attachment.name : 'Lampirkan surat / bukti (opsional)'}<input type="file" accept="image/*" className="hidden" onChange={(e) => setAttachment(e.target.files?.[0] || null)}/></label>
          <button disabled={loading} className="w-full rounded-xl bg-[var(--primary)] p-3 text-xs font-bold text-white disabled:opacity-50">KIRIM PENGAJUAN</button>
        </form>
        <div className="space-y-2"><h3 className="mb-3 text-sm font-bold">{canManage ? 'Antrean Izin Staff' : 'Riwayat Pengajuan Saya'}</h3>{visibleLeaves.length === 0 ? <p className="rounded-2xl bg-[var(--surface-secondary)] p-8 text-center text-xs font-bold text-slate-400">Belum ada pengajuan izin.</p> : visibleLeaves.map((item) => <div key={item.id} className="rounded-2xl border border-[var(--panel-border)] p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="text-sm font-bold">{item.staffName}</p><p className="text-[11px] font-bold text-slate-500">{item.leave_type} - {item.start_date} s/d {item.end_date}</p></div><span className={`h-fit rounded-full px-2.5 py-1 text-[11px] font-bold ${item.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : item.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' : 'bg-[var(--brand-100)] text-[var(--primary-text)]'}`}>{item.status}</span></div><p className="mt-2 text-xs text-slate-600">{item.reason}</p>{item.attachment_url && <a href={item.attachment_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[var(--primary-hover)]"><FileCheck2 className="h-3 w-3"/>Lihat lampiran</a>}{canManage && item.status === 'PENDING' && <div className="mt-3 flex gap-2"><button onClick={() => void decideLeave(item.id, 'APPROVED')} className="rounded-lg bg-[var(--primary)] px-3 py-2 text-[11px] font-bold text-white">SETUJUI</button><button onClick={() => void decideLeave(item.id, 'REJECTED')} className="rounded-lg border border-rose-200 px-3 py-2 text-[11px] font-bold text-rose-600">TOLAK</button></div>}</div>)}</div>
      </div>}

      {tab === 'PAYROLL' && canManage && (
        <div className="space-y-6">

          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-card)] p-4 md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary-hover)]"><Settings2 className="h-4 w-4" /></span><div><h3 className="text-sm font-bold">Kebijakan HR Outlet</h3><p className="mt-1 text-[10px] font-semibold text-slate-400">Ditampilkan kepada karyawan dan dipakai untuk kalkulasi payroll.</p></div></div>
              <button type="button" onClick={() => void saveHrPolicy()} disabled={loading} className="ui-button ui-button-primary gap-2"><Save className="h-3.5 w-3.5" /> Simpan kebijakan</button>
            </div>
            <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_320px]">
              <div><p className="ui-form-label mb-2">Alasan tidak masuk yang tersedia</p><div className="grid gap-2 sm:grid-cols-2">{hrConfigDraft.leaveReasons.map((reason, index) => <div key={reason.code} className="rounded-xl border border-[var(--panel-border)] bg-white p-3"><div className="flex items-center gap-2"><input value={reason.label} maxLength={40} onChange={(event) => setHrConfigDraft((current) => ({ ...current, leaveReasons: current.leaveReasons.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) }))} className="ui-input min-w-0 flex-1 text-xs font-bold" /><label className="flex items-center gap-1 text-[9px] font-bold text-slate-500"><input type="checkbox" checked={reason.enabled} onChange={(event) => setHrConfigDraft((current) => ({ ...current, leaveReasons: current.leaveReasons.map((item, itemIndex) => itemIndex === index ? { ...item, enabled: event.target.checked } : item) }))} /> Aktif</label></div><label className="mt-2 flex items-center gap-1 text-[9px] font-bold text-slate-400"><input type="checkbox" checked={reason.paid} onChange={(event) => setHrConfigDraft((current) => ({ ...current, leaveReasons: current.leaveReasons.map((item, itemIndex) => itemIndex === index ? { ...item, paid: event.target.checked } : item) }))} /> Tetap dibayar</label></div>)}</div></div>
              <div className="space-y-4"><label className="ui-form-group"><span className="ui-form-label">Toleransi telat sebelum penalti</span><div className="relative"><input type="number" min="0" max="180" value={hrConfigDraft.latePenaltyGraceMinutes} onChange={(event) => setHrConfigDraft((current) => ({ ...current, latePenaltyGraceMinutes: Number(event.target.value) }))} className="ui-input pr-16 font-mono" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">menit</span></div></label><div><p className="ui-form-label mb-2">Hari kerja</p><div className="flex flex-wrap gap-1.5">{['Min','Sen','Sel','Rab','Kam','Jum','Sab'].map((label, day) => { const active = hrConfigDraft.workingDays.includes(day); return <button type="button" key={label} onClick={() => setHrConfigDraft((current) => ({ ...current, workingDays: active ? current.workingDays.filter((value) => value !== day) : [...current.workingDays, day].sort() }))} className={`h-9 min-w-10 rounded-xl border px-2 text-[9px] font-black ${active ? 'border-[var(--primary)] bg-[var(--primary)] text-white' : 'border-slate-200 bg-white text-slate-400'}`}>{label}</button>; })}</div></div></div>
            </div>
          </div>

          {/* ── Aturan Penalty & Lembur ── */}
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-card)] p-4 md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h3 className="text-sm font-bold">Aturan Penalty Telat & Lembur</h3><p className="mt-1 text-[10px] font-semibold text-slate-400">Dipakai saat finalisasi payroll untuk semua staff. Nominal bisa diubah kapan saja.</p></div>
              <button type="button" onClick={() => void saveHrPolicy()} disabled={loading} className="ui-button ui-button-primary gap-2"><Save className="h-3.5 w-3.5" /> Simpan aturan</button>
            </div>
            <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_260px]">
              <div>
                <p className="ui-form-label mb-2">Potongan telat bertingkat (per kejadian)</p>
                <div className="space-y-2">
                  {tiersDraft.map((tier, index) => (
                    <div key={index} className="grid grid-cols-1 gap-2 rounded-xl border border-[var(--panel-border)] bg-white p-2.5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">
                          {index === tiersDraft.length - 1 ? 'Telat lebih dari (menit)' : 'Telat sampai (menit)'}
                        </span>
                        <input type="number" min={1} inputMode="numeric" value={tier.maxMinutes}
                          onChange={(e) => updateTier(index, { maxMinutes: Number(e.target.value) || 0 })}
                          className="ui-input w-full font-mono text-sm" />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">Potongan (Rp)</span>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">Rp</span>
                          <input type="number" min={0} inputMode="numeric" value={tier.amount}
                            onChange={(e) => updateTier(index, { amount: Number(e.target.value) || 0 })}
                            className="ui-input w-full pl-9 font-mono text-sm" placeholder="0" />
                        </div>
                      </label>
                      <button type="button" onClick={() => removeTier(index)} title="Hapus tingkat"
                        className="h-10 w-10 shrink-0 rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600"><X className="mx-auto h-4 w-4" /></button>
                    </div>
                  ))}
                  <button type="button" onClick={addTier} className="text-[12px] font-bold text-[var(--primary-hover)] hover:underline">+ Tambah tingkat</button>
                </div>
                <p className="mt-2 text-[10px] leading-snug text-slate-400">Telat melebihi batas tertinggi memakai tarif tingkat terakhir. Bila semua nominal 0, sistem memakai tarif "Potongan/Menit" per staff (lama). Toleransi telat diatur di Kebijakan HR di atas.</p>
              </div>
              <div className="space-y-4">
                <label className="ui-form-group"><span className="ui-form-label">Lembur dihitung mulai</span><div className="relative"><input type="number" min={0} max={480} value={hrConfigDraft.overtimeMinMinutes ?? 30} onChange={(e) => setHrConfigDraft((c) => ({ ...c, overtimeMinMinutes: Number(e.target.value) }))} className="ui-input pr-16 font-mono" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">menit</span></div></label>
                <p className="text-[10px] leading-snug text-slate-400">Kelebihan kerja setelah jadwal pulang dihitung lembur bila mencapai menit ini. Tarif lembur/jam diatur per staff di tombol "Atur Gaji".</p>
              </div>
            </div>
          </div>

          {/* ── Rekap Payroll Bulanan ── */}
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="ui-stat-label">Rekap Payroll</p>
                <h3 className="ui-section-title">Gaji Flat Bulanan Karyawan</h3>
              </div>
              <div className="flex items-center gap-2">
                <label className="ui-form-label">Periode</label>
                <input type="month" className="ui-input w-auto"
                  value={slipPeriod}
                  onChange={(e) => setSlipPeriod(e.target.value)} />
              </div>
            </div>

            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-secondary)] p-3">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[9px] font-black tracking-wider ${payrollPeriodStatus === 'LOCKED' ? 'bg-slate-900 text-white' : payrollPeriodStatus === 'PAID' ? 'bg-emerald-100 text-emerald-700' : payrollPeriodStatus === 'FINALIZED' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'}`}>{payrollPeriodStatus}</span>
                <div><p className="text-[11px] font-black text-[var(--text-primary)]">Kontrol Periode Payroll</p><p className="text-[9px] font-semibold text-[var(--text-tertiary)]">DRAFT → FINALIZED → PAID → LOCKED. Finalisasi membekukan absensi, telat, lembur berbasis pasangan CLOCK IN/OUT, dan kasbon menjadi snapshot histori.</p></div>
              </div>
              <div className="flex flex-wrap gap-2">
                {(payrollPeriodStatus === 'DRAFT' || payrollPeriodStatus === 'FINALIZED') && <button type="button" disabled={loading} onClick={() => void finalizePeriod()} className="ui-button ui-button-secondary min-h-8 px-3 text-[10px]">{payrollPeriodStatus === 'FINALIZED' ? 'Hitung ulang snapshot' : 'Finalisasi periode'}</button>}
                {payrollPeriodStatus === 'FINALIZED' && <button type="button" disabled={loading} onClick={() => void markPeriodPaid()} className="ui-button ui-button-primary min-h-8 px-3 text-[10px]">Tandai dibayar</button>}
                {payrollPeriodStatus === 'PAID' && <button type="button" disabled={loading} onClick={() => void lockPeriod()} className="ui-button ui-button-primary min-h-8 px-3 text-[10px]">Kunci payroll</button>}
              </div>
            </div>

            <div className="space-y-2">
              {branchStaff.map((staff) => {
                const profile = data.payrollProfiles.find((p) => p.user_id === staff.id);
                const slip = slipStaff?.id === staff.id ? buildSlip(staff, slipPeriod) : null;
                const grossSalary = profile
                  ? (profile.base_salary + (profile.meal_allowance || 0) + (profile.transport_allowance || 0))
                  : 0;

                return (
                  <div key={staff.id} className="rounded-2xl border"
                    style={{ borderColor: 'var(--panel-border)', background: 'var(--surface-card)' }}>
                    {/* Row header */}
                    <div className="flex flex-wrap items-center gap-3 p-4">
                      {/* Avatar */}
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-white text-[13px]"
                        style={{ background: 'var(--primary)' }}>
                        {staff.name.slice(0, 2).toUpperCase()}
                      </div>

                      {/* Name + role */}
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-[13px]" style={{ color: 'var(--text-primary)' }}>{staff.name}</p>
                        <p className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                          {staff.role}
                          {staff.joinDate && ` · Bergabung ${new Date(staff.joinDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                          {staff.phone && ` · ${staff.phone}`}
                        </p>
                      </div>

                      {/* Gaji total */}
                      <div className="text-right shrink-0">
                        <p className="text-[14px] font-extrabold tabular-nums" style={{ color: profile ? 'var(--primary-solid)' : 'var(--text-tertiary)' }}>
                          {profile ? `Rp ${grossSalary.toLocaleString('id-ID')}` : 'Belum diatur'}
                        </p>
                        <p className="text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>gaji kotor / bulan</p>
                      </div>

                      {/* Actions */}
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button onClick={() => openPayroll(staff)}
                          className="ui-button ui-button-soft gap-1.5 text-[11px]" style={{ minHeight: '32px', padding: '0 12px' }}>
                          <WalletCards className="h-3.5 w-3.5" />
                          Atur Gaji
                        </button>
                        <button
                          onClick={() => setSlipStaff(slipStaff?.id === staff.id ? null : staff)}
                          className="ui-button ui-button-secondary gap-1.5 text-[11px]" style={{ minHeight: '32px', padding: '0 12px' }}>
                          Slip Gaji
                        </button>
                        <button
                          onClick={() => setHistoryStaff(staff)}
                          className="ui-button ui-button-secondary gap-1.5 text-[11px]" style={{ minHeight: '32px', padding: '0 12px' }}>
                          <History className="h-3.5 w-3.5" />
                          Histori
                        </button>
                        <button onClick={() => openKasbon(staff)}
                          className="ui-button ui-button-secondary gap-1.5 text-[11px]" style={{ minHeight: '32px', padding: '0 12px' }}>
                          <Plus className="h-3.5 w-3.5" />
                          Kasbon
                        </button>
                      </div>
                    </div>

                    {/* Expanded slip preview */}
                    {slipStaff?.id === staff.id && (
                      <div className="border-t px-4 pb-4 pt-3 space-y-3"
                        style={{ borderColor: 'var(--panel-border-light)', background: 'var(--surface-secondary)' }}>
                        {slip ? (
                          <>
                            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                              Slip Gaji — {slip.periodLabel}
                            </p>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                              {[
                                { label: 'Gaji Pokok', value: slip.baseSalary, color: 'var(--text-primary)' },
                                { label: 'Tunjangan Makan', value: slip.mealAllowance },
                                { label: 'Tunjangan Transport', value: slip.transportAllowance },
                                { label: `Lembur (${slip.overtimeMinutes} mnt)`, value: slip.overtimePay, color: slip.overtimePay > 0 ? 'var(--accent-green)' : undefined },
                                { label: 'Bonus', value: slip.bonus, color: slip.bonus > 0 ? 'var(--accent-green)' : undefined },
                                { label: 'Gaji Kotor', value: slip.grossSalary, color: 'var(--primary-solid)', bold: true },
                                { label: 'Potongan Terlambat', value: -slip.lateDeduction, color: slip.lateDeduction > 0 ? 'var(--accent-red)' : undefined },
                                { label: 'Kasbon', value: -slip.kasbonDeduction, color: slip.kasbonDeduction > 0 ? 'var(--accent-red)' : undefined },
                              ].map((s) => (
                                <div key={s.label} className="rounded-xl p-2.5"
                                  style={{ background: 'var(--surface-card)', border: '1px solid var(--panel-border)' }}>
                                  <p className="ui-stat-label">{s.label}</p>
                                  <p className={`mt-1 text-[13px] tabular-nums ${s.bold ? 'font-extrabold' : 'font-bold'}`}
                                    style={{ color: s.color || 'var(--text-secondary)' }}>
                                    Rp {Math.abs(s.value).toLocaleString('id-ID')}
                                  </p>
                                </div>
                              ))}
                            </div>

                            {/* Bonus manual (reward) */}
                            <div className="flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5"
                              style={{ borderColor: 'var(--panel-border)', background: 'var(--surface-card)' }}>
                              <span className="text-[11px] font-bold" style={{ color: 'var(--text-secondary)' }}>Bonus / Reward {slip.periodLabel}</span>
                              <div className="relative ml-auto">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold" style={{ color: 'var(--text-tertiary)' }}>Rp</span>
                                <input type="number" min={0} value={bonusDraft}
                                  onChange={(e) => setBonusDraft(e.target.value === '' ? '' : Number(e.target.value))}
                                  className="ui-input w-32 pl-7 font-mono text-[12px]" placeholder="0" />
                              </div>
                              <button type="button" disabled={savingBonus} onClick={() => void saveBonus(staff)}
                                className="ui-button ui-button-secondary text-[11px]" style={{ minHeight: '32px', padding: '0 12px' }}>
                                Simpan Bonus
                              </button>
                            </div>

                            {/* Total bersih */}
                            <div className="flex items-center justify-between rounded-xl border px-4 py-3"
                              style={{ background: 'var(--primary-soft)', borderColor: 'var(--primary-border)' }}>
                              <span className="font-bold text-[13px]" style={{ color: 'var(--primary-text)' }}>
                                Total Gaji Bersih
                              </span>
                              <span className="text-[20px] font-extrabold tabular-nums" style={{ color: 'var(--primary-solid)' }}>
                                Rp {slip.netSalary.toLocaleString('id-ID')}
                              </span>
                            </div>

                            {/* Send WA */}
                            <div className="flex justify-end">
                              <a
                                href={buildWhatsAppSlipUrl(slip, currentBranch.name)}
                                target="_blank" rel="noreferrer"
                                className="ui-button ui-button-primary gap-2"
                                style={{ background: '#25d366', borderColor: '#25d366' }}
                              >
                                <MessageCircle className="h-4 w-4" />
                                Kirim via WhatsApp
                              </a>
                            </div>

                            <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                              Hadir: {slip.attendanceCount} hari · Terlambat: {slip.lateMinutes} menit
                            </p>
                          </>
                        ) : (
                          <p className="py-4 text-center text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                            Komponen payroll belum diatur untuk karyawan ini.{' '}
                            <button className="font-bold underline" style={{ color: 'var(--primary-hover)' }}
                              onClick={() => openPayroll(staff)}>
                              Atur sekarang
                            </button>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Kasbon Pending ── */}
          {(data.kasbonRecords || []).filter((k) => k.status === 'PENDING').length > 0 && (
            <div>
              <p className="ui-stat-label mb-2">Kasbon Menunggu Persetujuan</p>
              <div className="space-y-2">
                {(data.kasbonRecords || []).filter((k) => k.status === 'PENDING').map((k) => (
                  <div key={k.id} className="flex flex-wrap items-center gap-3 rounded-2xl border p-3"
                    style={{ borderColor: 'var(--warning-soft)', background: 'var(--warning-soft)' }}>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-[13px]" style={{ color: 'var(--text-primary)' }}>{k.staffName}</p>
                      <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                        {k.reason} · Potongan: {k.deduct_month || '-'} · Diajukan: {new Date(k.requested_at).toLocaleDateString('id-ID')}
                      </p>
                    </div>
                    <p className="font-extrabold tabular-nums text-[14px]" style={{ color: 'var(--accent-amber)' }}>
                      Rp {k.amount.toLocaleString('id-ID')}
                    </p>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => void approveKasbon(k, 'APPROVED')}
                        className="ui-button ui-button-primary gap-1 text-[11px]" style={{ minHeight: '32px', padding: '0 12px' }}>
                        Setujui
                      </button>
                      <button onClick={() => void approveKasbon(k, 'REJECTED')}
                        className="ui-button ui-button-danger gap-1 text-[11px]" style={{ minHeight: '32px', padding: '0 12px' }}>
                        Tolak
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {detailStaff && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md"
          style={{ background: 'rgba(24,24,27,0.45)' }}>
          <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl border bg-white p-5"
            style={{ borderColor: 'var(--panel-border)' }}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserRoundSearch className="h-5 w-5" style={{ color: 'var(--primary-hover)' }} />
                <div>
                  <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>{detailStaff.name}</h3>
                  <p className="text-[11px] font-medium" style={{ color: 'var(--text-tertiary)' }}>Riwayat 30 Hari — {detailStaff.role}</p>
                </div>
              </div>
              <button onClick={() => setDetailStaff(null)} className="ui-icon-button h-8 w-8"><X className="h-4 w-4" /></button>
            </div>
            {detailRecords.length === 0 ? (
              <p className="py-10 text-center text-[12px] font-medium" style={{ color: 'var(--text-tertiary)' }}>Belum ada catatan.</p>
            ) : (
              detailRecords.map((record) => (
                <div key={record.id} className="mb-2 flex justify-between rounded-xl border p-3"
                  style={{ borderColor: 'var(--panel-border)', background: 'var(--surface-card)' }}>
                  <div>
                    <p className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>{record.type.replace('_', ' ')}</p>
                    <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{new Date(record.timestamp).toLocaleString('id-ID')}</p>
                  </div>
                  <span className="text-[11px] font-bold"
                    style={{ color: record.status === 'LATE' ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                    {record.status === 'LATE' ? `TERLAMBAT ${record.minutesLate || 0} MENIT` : 'TEPAT WAKTU'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {payrollStaff && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md"
          style={{ background: 'rgba(24,24,27,0.45)' }}>
          <div className="w-full max-w-lg rounded-2xl border bg-white"
            style={{ borderColor: 'var(--panel-border)', boxShadow: '0 24px 60px rgba(0,0,0,0.15)' }}>
            {/* Header */}
            <div className="flex items-center justify-between border-b px-5 py-4"
              style={{ borderColor: 'var(--panel-border-light)' }}>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ background: 'var(--primary-soft)', color: 'var(--primary-hover)' }}>
                  <WalletCards className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>Komponen Payroll</h3>
                  <p className="text-[11px] font-medium" style={{ color: 'var(--text-tertiary)' }}>{payrollStaff.name} — Gaji flat bulanan</p>
                </div>
              </div>
              <button onClick={() => setPayrollStaff(null)} className="ui-icon-button h-8 w-8"><X className="h-4 w-4" /></button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-3">
              <p className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                Semua nominal bersifat <strong>flat per bulan</strong> — tidak berubah berdasarkan jumlah hari kalender.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  { key: 'baseSalary',            label: 'Gaji Pokok (Flat / Bulan)' },
                  { key: 'mealAllowance',          label: 'Tunjangan Makan' },
                  { key: 'transportAllowance',     label: 'Tunjangan Transport' },
                  { key: 'overtimeHourlyRate',     label: 'Lembur / Jam' },
                  { key: 'lateDeductionPerMinute', label: 'Potongan Terlambat / Menit' },
                ] as const).map(({ key, label }) => (
                  <label key={key} className="ui-form-group">
                    <span className="ui-form-label">{label}</span>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[11px] font-bold" style={{ color: 'var(--text-tertiary)' }}>Rp</span>
                      <input type="number" min="0" className="ui-input pl-9 font-mono"
                        value={payroll[key]}
                        onChange={(e) => setPayroll({ ...payroll, [key]: Number(e.target.value) })} />
                    </div>
                  </label>
                ))}
              </div>
              {/* Preview total */}
              <div className="flex items-center justify-between rounded-xl border px-4 py-3 mt-2"
                style={{ background: 'var(--primary-soft)', borderColor: 'var(--primary-border)' }}>
                <span className="text-[12px] font-bold" style={{ color: 'var(--primary-text)' }}>Gaji Kotor / Bulan</span>
                <span className="text-[18px] font-extrabold tabular-nums" style={{ color: 'var(--primary-solid)' }}>
                  Rp {(payroll.baseSalary + payroll.mealAllowance + payroll.transportAllowance).toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 border-t px-5 py-4"
              style={{ borderColor: 'var(--panel-border-light)' }}>
              <button onClick={() => setPayrollStaff(null)} className="ui-button ui-button-secondary">Batal</button>
              <button onClick={() => void savePayroll()} disabled={loading} className="ui-button ui-button-primary">
                Simpan Komponen Payroll
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Kasbon ── */}
      {kasbonStaff && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md"
          style={{ background: 'rgba(24,24,27,0.45)' }}>
          <div className="w-full max-w-md rounded-2xl border bg-white"
            style={{ borderColor: 'var(--panel-border)', boxShadow: '0 24px 60px rgba(0,0,0,0.15)' }}>
            <div className="flex items-center justify-between border-b px-5 py-4"
              style={{ borderColor: 'var(--panel-border-light)' }}>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ background: 'var(--warning-soft)', color: 'var(--accent-amber)' }}>
                  <Minus className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>Catat Kasbon</h3>
                  <p className="text-[11px] font-medium" style={{ color: 'var(--text-tertiary)' }}>{kasbonStaff.name}</p>
                </div>
              </div>
              <button onClick={() => setKasbonStaff(null)} className="ui-icon-button h-8 w-8"><X className="h-4 w-4" /></button>
            </div>

            <div className="p-5 space-y-3">
              <div className="ui-form-group">
                <label className="ui-form-label">Nominal Kasbon (Rp)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[11px] font-bold" style={{ color: 'var(--text-tertiary)' }}>Rp</span>
                  <input type="number" min="1" className="ui-input pl-9 font-mono"
                    placeholder="0" value={kasbonAmount}
                    onChange={(e) => setKasbonAmount(e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
                {(() => {
                  const profile = data.payrollProfiles.find((p) => p.user_id === kasbonStaff.id);
                  if (!profile?.base_salary) return null;
                  const maxKasbon = Math.round(profile.base_salary * 0.5);
                  return (
                    <p className="text-[11px] font-medium mt-1" style={{ color: 'var(--text-tertiary)' }}>
                      Maks. kasbon: Rp {maxKasbon.toLocaleString('id-ID')} (50% gaji pokok)
                    </p>
                  );
                })()}
              </div>

              <div className="ui-form-group">
                <label className="ui-form-label">Keterangan / Alasan</label>
                <input type="text" className="ui-input" placeholder="Keperluan mendesak..."
                  value={kasbonReason}
                  onChange={(e) => setKasbonReason(e.target.value)} />
              </div>

              <div className="ui-form-group">
                <label className="ui-form-label">Bulan Pemotongan Gaji</label>
                <input type="month" className="ui-input"
                  value={kasbonMonth}
                  onChange={(e) => setKasbonMonth(e.target.value)} />
                <p className="text-[11px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                  Kasbon akan otomatis dipotong dari slip gaji bulan yang dipilih.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t px-5 py-4"
              style={{ borderColor: 'var(--panel-border-light)' }}>
              <button onClick={() => setKasbonStaff(null)} className="ui-button ui-button-secondary">Batal</button>
              <button onClick={() => void submitKasbon()} disabled={loading} className="ui-button ui-button-primary gap-1.5">
                <Send className="h-3.5 w-3.5" />
                Ajukan Kasbon
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Histori Gaji per Staff ── */}
      {historyStaff && (() => {
        const snaps = (data.payrollSnapshots || [])
          .filter((s) => s.user_id === historyStaff.id)
          .sort((a, b) => b.period.localeCompare(a.period));
        const totalNet = snaps.reduce((sum, s) => sum + Number(s.net_salary || 0), 0);
        const statusOf = (period: string) => (data.payrollPeriods || []).find((p) => p.period === period)?.status || 'FINALIZED';
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md" style={{ background: 'rgba(24,24,27,0.45)' }}>
            <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border bg-white p-5" style={{ borderColor: 'var(--panel-border)' }}>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5" style={{ color: 'var(--primary-hover)' }} />
                  <div>
                    <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>Histori Gaji — {historyStaff.name}</h3>
                    <p className="text-[11px] font-medium" style={{ color: 'var(--text-tertiary)' }}>{snaps.length} periode terfinalisasi · Total {money(totalNet)}</p>
                  </div>
                </div>
                <button onClick={() => setHistoryStaff(null)} className="ui-icon-button h-8 w-8"><X className="h-4 w-4" /></button>
              </div>
              {snaps.length === 0 ? (
                <p className="py-10 text-center text-[12px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                  Belum ada histori. Histori gaji muncul setelah periode payroll <b>difinalisasi</b> pada rekap payroll.
                </p>
              ) : (
                <div className="space-y-2">
                  {snaps.map((s) => {
                    const slip = buildSlip(historyStaff, s.period);
                    const status = statusOf(s.period);
                    const [yr, mo] = s.period.split('-').map(Number);
                    const label = new Date(yr, mo - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
                    return (
                      <div key={s.id} className="rounded-2xl border p-4" style={{ borderColor: 'var(--panel-border)', background: 'var(--surface-card)' }}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>{label}</p>
                            <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                              Kotor {money(Number(s.gross_salary || 0))} · Potongan {money(Number(s.total_deduction || 0))} · Hadir {s.attendance_count} hari · Telat {s.late_minutes} mnt
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`rounded-full px-2.5 py-1 text-[9px] font-black tracking-wider ${status === 'LOCKED' ? 'bg-slate-900 text-white' : status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'}`}>{status}</span>
                            <span className="text-[15px] font-extrabold tabular-nums" style={{ color: 'var(--primary-solid)' }}>{money(Number(s.net_salary || 0))}</span>
                          </div>
                        </div>
                        {slip && (
                          <div className="mt-3 flex justify-end">
                            <a href={buildWhatsAppSlipUrl(slip, currentBranch.name)} target="_blank" rel="noreferrer"
                              className="ui-button gap-2 text-[11px]" style={{ minHeight: '32px', padding: '0 12px', background: '#25d366', borderColor: '#25d366', color: '#fff' }}>
                              <MessageCircle className="h-3.5 w-3.5" /> Kirim ulang via WA
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </section>
  );
}
