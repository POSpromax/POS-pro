import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, ChevronRight, FileCheck2, MessageCircle, Minus,
  Paperclip, Plus, Send, UserRoundSearch, WalletCards, X,
} from 'lucide-react';
import type { AttendanceRecord, Branch, UserAccount } from '../../types/pos';
import { uploadImage } from '../../services/cloudinaryMedia';
import { cloudReadiness } from '../../lib/runtimeEnv';
import {
  buildWhatsAppSlipUrl,
  calculatePayslip,
  loadHrData,
  requestKasbon,
  reviewKasbon,
  reviewLeave,
  savePayrollProfile,
  submitLeave,
  type HrData,
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

  // ── Kasbon state ────────────────────────────────────────────────────────────
  const [kasbonStaff, setKasbonStaff]   = useState<UserAccount | null>(null);
  const [kasbonAmount, setKasbonAmount] = useState<number | ''>('');
  const [kasbonReason, setKasbonReason] = useState('');
  const [kasbonMonth, setKasbonMonth]   = useState<string>('');   // "YYYY-MM"

  // ── Payslip state ───────────────────────────────────────────────────────────
  const [slipStaff, setSlipStaff]       = useState<UserAccount | null>(null);
  const [slipPeriod, setSlipPeriod]     = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const refresh = async () => {
    if (!cloudReadiness.supabase) return;
    setLoading(true);
    setError('');
    try { setData(await loadHrData(currentBranch.id)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Data HR gagal dimuat'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void refresh(); }, [currentBranch.id, activeUser.id]);

  const branchStaff = useMemo(() => staffAccounts.filter((staff) => staff.isActive !== false && (!staff.branchIds?.length || staff.branchIds.includes(currentBranch.id))), [staffAccounts, currentBranch.id]);
  const recordsByStaff = useMemo(() => new Map(branchStaff.map((staff) => [staff.id, attendanceRecords.filter((record) => record.staffId === staff.id)])), [branchStaff, attendanceRecords]);

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
    const profile = data.payrollProfiles.find((p) => p.user_id === staff.id);
    if (!profile) return null;

    // Hitung menit terlambat dari attendance bulan terpilih
    const [yr, mo] = period.split('-').map(Number);
    const staffRecords = (recordsByStaff.get(staff.id) || []).filter((r) => {
      const d = new Date(r.timestamp);
      return d.getFullYear() === yr && d.getMonth() + 1 === mo;
    });
    const lateMinutes = staffRecords
      .filter((r) => r.type === 'CLOCK_IN' && r.status === 'LATE')
      .reduce((s, r) => s + (r.minutesLate || 0), 0);
    const attendanceCount = staffRecords.filter((r) => r.type === 'CLOCK_IN').length;

    // Kasbon yang dipotong bulan ini
    const kasbonDeduction = (data.kasbonRecords || [])
      .filter((k) => k.user_id === staff.id && k.deduct_month === period && k.status === 'APPROVED')
      .reduce((s, k) => s + k.amount, 0);

    return calculatePayslip({
      profile,
      staffId: staff.id,
      staffName: staff.name,
      phone: staff.phone,
      period,
      lateMinutes,
      attendanceCount,
      kasbonDeduction,
    });
  };

  const visibleLeaves = canManage ? data.leaveRequests : data.leaveRequests.filter((item) => item.user_id === activeUser.id);
  const detailRecords = detailStaff ? (recordsByStaff.get(detailStaff.id) || []).slice().sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp)) : [];

  return (
    <section className="mt-6 rounded-2xl border border-[var(--panel-border)] bg-white p-4 shadow-sm md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-bold text-[var(--text-primary)]">Kehadiran & HR</h2><p className="text-xs font-semibold text-slate-500">Riwayat, izin, dan komponen payroll terhubung per outlet.</p></div>
        <div className="flex rounded-2xl bg-[var(--surface-secondary)] p-1 text-[11px] font-bold">
          <button onClick={() => setTab('HISTORY')} className={`rounded-xl px-3 py-2 ${tab === 'HISTORY' ? 'bg-[var(--primary)] text-white' : 'text-slate-500'}`}>DETAIL ABSEN</button>
          <button onClick={() => setTab('LEAVE')} className={`rounded-xl px-3 py-2 ${tab === 'LEAVE' ? 'bg-[var(--primary)] text-white' : 'text-slate-500'}`}>AJUKAN IZIN</button>
          {canManage && <button onClick={() => setTab('PAYROLL')} className={`rounded-xl px-3 py-2 ${tab === 'PAYROLL' ? 'bg-[var(--primary)] text-white' : 'text-slate-500'}`}>PAYROLL</button>}
        </div>
      </div>
      {error && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">{error}</div>}

      {tab === 'HISTORY' && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(canManage ? branchStaff : branchStaff.filter((staff) => staff.id === activeUser.id)).map((staff) => {
          const records = recordsByStaff.get(staff.id) || [];
          const last = records.slice().sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp))[0];
          return <button key={staff.id} onClick={() => setDetailStaff(staff)} className="flex items-center gap-3 rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-card)] p-4 text-left transition hover:border-[var(--primary)] hover:bg-[var(--brand-100)]/40">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--primary)] font-bold text-white">{staff.name.slice(0, 2).toUpperCase()}</div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{staff.name}</p><p className="text-[11px] font-bold text-slate-400">{staff.role} - {records.length} catatan / 30 hari</p><p className={`mt-1 text-[11px] font-bold ${last ? 'text-[var(--primary-hover)]' : 'text-slate-400'}`}>{last ? `${last.type.replace('_', ' ')} - ${new Date(last.timestamp).toLocaleString('id-ID')}` : 'Belum ada presensi'}</p></div>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </button>;
        })}
      </div>}

      {tab === 'LEAVE' && <div className="grid gap-5 lg:grid-cols-[minmax(280px,420px)_1fr]">
        <form onSubmit={sendLeave} className="space-y-3 rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-card)] p-4">
          <div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-[var(--primary-hover)]"/><h3 className="text-sm font-bold">Pengajuan Izin Tidak Masuk</h3></div>
          <select value={leave.leaveType} onChange={(e) => setLeave({ ...leave, leaveType: e.target.value })} className="w-full rounded-xl border border-[var(--panel-border)] bg-white p-3 text-xs font-bold"><option value="SICK">Sakit</option><option value="PERMIT">Izin pribadi</option><option value="ANNUAL">Cuti tahunan</option><option value="UNPAID">Izin tanpa dibayar</option></select>
          <div className="grid grid-cols-2 gap-2"><label className="text-[11px] font-bold text-slate-500">MULAI<input type="date" value={leave.startDate} onChange={(e) => setLeave({ ...leave, startDate: e.target.value })} className="mt-1 w-full rounded-xl border border-[var(--panel-border)] bg-white p-3 text-xs"/></label><label className="text-[11px] font-bold text-slate-500">SAMPAI<input type="date" value={leave.endDate} min={leave.startDate} onChange={(e) => setLeave({ ...leave, endDate: e.target.value })} className="mt-1 w-full rounded-xl border border-[var(--panel-border)] bg-white p-3 text-xs"/></label></div>
          <textarea value={leave.reason} onChange={(e) => setLeave({ ...leave, reason: e.target.value })} maxLength={500} placeholder="Keterangan izin..." className="min-h-24 w-full rounded-xl border border-[var(--panel-border)] bg-white p-3 text-xs"/>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--brand-200)] bg-[var(--brand-50)] p-3 text-xs font-bold text-[var(--primary-text)]"><Paperclip className="h-4 w-4"/>{attachment ? attachment.name : 'Lampirkan surat / bukti (opsional)'}<input type="file" accept="image/*" className="hidden" onChange={(e) => setAttachment(e.target.files?.[0] || null)}/></label>
          <button disabled={loading} className="w-full rounded-xl bg-[var(--primary)] p-3 text-xs font-bold text-white disabled:opacity-50">KIRIM PENGAJUAN</button>
        </form>
        <div className="space-y-2"><h3 className="mb-3 text-sm font-bold">{canManage ? 'Antrean Izin Staff' : 'Riwayat Pengajuan Saya'}</h3>{visibleLeaves.length === 0 ? <p className="rounded-2xl bg-[var(--surface-secondary)] p-8 text-center text-xs font-bold text-slate-400">Belum ada pengajuan izin.</p> : visibleLeaves.map((item) => <div key={item.id} className="rounded-2xl border border-[var(--panel-border)] p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="text-sm font-bold">{item.staffName}</p><p className="text-[11px] font-bold text-slate-500">{item.leave_type} - {item.start_date} s/d {item.end_date}</p></div><span className={`h-fit rounded-full px-2.5 py-1 text-[11px] font-bold ${item.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : item.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' : 'bg-[var(--brand-100)] text-[var(--primary-text)]'}`}>{item.status}</span></div><p className="mt-2 text-xs text-slate-600">{item.reason}</p>{item.attachment_url && <a href={item.attachment_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[var(--primary-hover)]"><FileCheck2 className="h-3 w-3"/>Lihat lampiran</a>}{canManage && item.status === 'PENDING' && <div className="mt-3 flex gap-2"><button onClick={() => void decideLeave(item.id, 'APPROVED')} className="rounded-lg bg-[var(--primary)] px-3 py-2 text-[11px] font-bold text-white">SETUJUI</button><button onClick={() => void decideLeave(item.id, 'REJECTED')} className="rounded-lg border border-rose-200 px-3 py-2 text-[11px] font-bold text-rose-600">TOLAK</button></div>}</div>)}</div>
      </div>}

      {tab === 'PAYROLL' && canManage && (
        <div className="space-y-6">

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
    </section>
  );
}
