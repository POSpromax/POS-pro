import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronRight, FileCheck2, Paperclip, UserRoundSearch, WalletCards, X } from 'lucide-react';
import type { AttendanceRecord, Branch, UserAccount } from '../../types/pos';
import { uploadImage } from '../../services/cloudinaryMedia';
import { cloudReadiness } from '../../lib/runtimeEnv';
import { loadHrData, reviewLeave, savePayrollProfile, submitLeave, type HrData, type PayrollProfile } from '../../services/hrService';

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

  const visibleLeaves = canManage ? data.leaveRequests : data.leaveRequests.filter((item) => item.user_id === activeUser.id);
  const detailRecords = detailStaff ? (recordsByStaff.get(detailStaff.id) || []).slice().sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp)) : [];

  return (
    <section className="mt-6 rounded-3xl border border-[#E4E2DF] bg-white p-4 shadow-sm md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-black text-[#1A1714]">Kehadiran & HR</h2><p className="text-xs font-semibold text-slate-500">Riwayat, izin, dan komponen payroll terhubung per outlet.</p></div>
        <div className="flex rounded-2xl bg-[#F1F1F0] p-1 text-[11px] font-black">
          <button onClick={() => setTab('HISTORY')} className={`rounded-xl px-3 py-2 ${tab === 'HISTORY' ? 'bg-[#1A1917] text-white' : 'text-slate-500'}`}>DETAIL ABSEN</button>
          <button onClick={() => setTab('LEAVE')} className={`rounded-xl px-3 py-2 ${tab === 'LEAVE' ? 'bg-[#EA580C] text-white' : 'text-slate-500'}`}>AJUKAN IZIN</button>
          {canManage && <button onClick={() => setTab('PAYROLL')} className={`rounded-xl px-3 py-2 ${tab === 'PAYROLL' ? 'bg-[#1A1917] text-white' : 'text-slate-500'}`}>PAYROLL</button>}
        </div>
      </div>
      {error && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">{error}</div>}

      {tab === 'HISTORY' && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(canManage ? branchStaff : branchStaff.filter((staff) => staff.id === activeUser.id)).map((staff) => {
          const records = recordsByStaff.get(staff.id) || [];
          const last = records.slice().sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp))[0];
          return <button key={staff.id} onClick={() => setDetailStaff(staff)} className="flex items-center gap-3 rounded-2xl border border-[#E7E2DE] bg-[#FAFAF9] p-4 text-left transition hover:border-orange-300 hover:bg-orange-50/40">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1A1917] font-black text-white">{staff.name.slice(0, 2).toUpperCase()}</div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{staff.name}</p><p className="text-[10px] font-bold text-slate-400">{staff.role} - {records.length} catatan / 30 hari</p><p className={`mt-1 text-[10px] font-black ${last ? 'text-[#C2410C]' : 'text-slate-400'}`}>{last ? `${last.type.replace('_', ' ')} - ${new Date(last.timestamp).toLocaleString('id-ID')}` : 'Belum ada presensi'}</p></div>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </button>;
        })}
      </div>}

      {tab === 'LEAVE' && <div className="grid gap-5 lg:grid-cols-[minmax(280px,420px)_1fr]">
        <form onSubmit={sendLeave} className="space-y-3 rounded-2xl border border-[#E7E2DE] bg-[#FAFAF9] p-4">
          <div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-[#C2410C]"/><h3 className="text-sm font-black">Pengajuan Izin Tidak Masuk</h3></div>
          <select value={leave.leaveType} onChange={(e) => setLeave({ ...leave, leaveType: e.target.value })} className="w-full rounded-xl border border-[#DEDAD5] bg-white p-3 text-xs font-bold"><option value="SICK">Sakit</option><option value="PERMIT">Izin pribadi</option><option value="ANNUAL">Cuti tahunan</option><option value="UNPAID">Izin tanpa dibayar</option></select>
          <div className="grid grid-cols-2 gap-2"><label className="text-[10px] font-black text-slate-500">MULAI<input type="date" value={leave.startDate} onChange={(e) => setLeave({ ...leave, startDate: e.target.value })} className="mt-1 w-full rounded-xl border border-[#DEDAD5] bg-white p-3 text-xs"/></label><label className="text-[10px] font-black text-slate-500">SAMPAI<input type="date" value={leave.endDate} min={leave.startDate} onChange={(e) => setLeave({ ...leave, endDate: e.target.value })} className="mt-1 w-full rounded-xl border border-[#DEDAD5] bg-white p-3 text-xs"/></label></div>
          <textarea value={leave.reason} onChange={(e) => setLeave({ ...leave, reason: e.target.value })} maxLength={500} placeholder="Keterangan izin..." className="min-h-24 w-full rounded-xl border border-[#DEDAD5] bg-white p-3 text-xs"/>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-orange-300 bg-orange-50 p-3 text-xs font-black text-orange-700"><Paperclip className="h-4 w-4"/>{attachment ? attachment.name : 'Lampirkan surat / bukti (opsional)'}<input type="file" accept="image/*" className="hidden" onChange={(e) => setAttachment(e.target.files?.[0] || null)}/></label>
          <button disabled={loading} className="w-full rounded-xl bg-[#EA580C] p-3 text-xs font-black text-white disabled:opacity-50">KIRIM PENGAJUAN</button>
        </form>
        <div className="space-y-2"><h3 className="mb-3 text-sm font-black">{canManage ? 'Antrean Izin Staff' : 'Riwayat Pengajuan Saya'}</h3>{visibleLeaves.length === 0 ? <p className="rounded-2xl bg-[#F5F5F4] p-8 text-center text-xs font-bold text-slate-400">Belum ada pengajuan izin.</p> : visibleLeaves.map((item) => <div key={item.id} className="rounded-2xl border border-[#E7E2DE] p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="text-sm font-black">{item.staffName}</p><p className="text-[10px] font-bold text-slate-500">{item.leave_type} - {item.start_date} s/d {item.end_date}</p></div><span className={`h-fit rounded-full px-2.5 py-1 text-[9px] font-black ${item.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : item.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' : 'bg-orange-100 text-orange-700'}`}>{item.status}</span></div><p className="mt-2 text-xs text-slate-600">{item.reason}</p>{item.attachment_url && <a href={item.attachment_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] font-black text-[#C2410C]"><FileCheck2 className="h-3 w-3"/>Lihat lampiran</a>}{canManage && item.status === 'PENDING' && <div className="mt-3 flex gap-2"><button onClick={() => void decideLeave(item.id, 'APPROVED')} className="rounded-lg bg-[#1A1917] px-3 py-2 text-[10px] font-black text-white">SETUJUI</button><button onClick={() => void decideLeave(item.id, 'REJECTED')} className="rounded-lg border border-rose-200 px-3 py-2 text-[10px] font-black text-rose-600">TOLAK</button></div>}</div>)}</div>
      </div>}

      {tab === 'PAYROLL' && canManage && <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead className="border-b text-[10px] font-black uppercase text-slate-400"><tr><th className="p-3">Staff</th><th>Gaji pokok</th><th>Tunjangan</th><th>Lembur / jam</th><th>Potongan telat / menit</th><th></th></tr></thead><tbody>{branchStaff.map((staff) => { const item = data.payrollProfiles.find((profile) => profile.user_id === staff.id); return <tr key={staff.id} className="border-b border-[#EEEAE6]"><td className="p-3"><p className="font-black">{staff.name}</p><p className="text-[9px] font-bold text-slate-400">{staff.role}</p></td><td className="font-bold">{money(item?.base_salary || 0)}</td><td>{money((item?.meal_allowance || 0) + (item?.transport_allowance || 0))}</td><td>{money(item?.overtime_hourly_rate || 0)}</td><td>{money(item?.late_deduction_per_minute || 0)}</td><td><button onClick={() => openPayroll(staff)} className="rounded-lg bg-orange-50 px-3 py-2 font-black text-[#C2410C]">ATUR</button></td></tr>; })}</tbody></table></div>}

      {detailStaff && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4"><div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-5"><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><UserRoundSearch className="h-5 w-5 text-[#C2410C]"/><div><h3 className="font-black">{detailStaff.name}</h3><p className="text-[10px] font-bold text-slate-400">RIWAYAT 30 HARI - {detailStaff.role}</p></div></div><button onClick={() => setDetailStaff(null)}><X/></button></div>{detailRecords.length === 0 ? <p className="py-10 text-center text-xs font-bold text-slate-400">Belum ada catatan.</p> : detailRecords.map((record) => <div key={record.id} className="mb-2 flex justify-between rounded-xl border border-[#E7E2DE] p-3"><div><p className="text-xs font-black">{record.type.replace('_', ' ')}</p><p className="text-[10px] text-slate-500">{new Date(record.timestamp).toLocaleString('id-ID')}</p></div><span className={`text-[10px] font-black ${record.status === 'LATE' ? 'text-rose-600' : 'text-emerald-600'}`}>{record.status === 'LATE' ? `TERLAMBAT ${record.minutesLate || 0} MENIT` : 'TEPAT WAKTU'}</span></div>)}</div></div>}

      {payrollStaff && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4"><div className="w-full max-w-lg rounded-3xl bg-white p-5"><div className="mb-4 flex justify-between"><div className="flex gap-2"><WalletCards className="text-[#C2410C]"/><div><h3 className="font-black">Payroll {payrollStaff.name}</h3><p className="text-[10px] font-bold text-slate-400">Nominal bulanan kecuali lembur dan potongan</p></div></div><button onClick={() => setPayrollStaff(null)}><X/></button></div><div className="grid gap-3 sm:grid-cols-2">{Object.entries({ baseSalary: 'Gaji pokok', mealAllowance: 'Uang makan', transportAllowance: 'Transport', overtimeHourlyRate: 'Lembur / jam', lateDeductionPerMinute: 'Potongan telat / menit' }).map(([key,label]) => <label key={key} className="text-[10px] font-black text-slate-500">{label.toUpperCase()}<input type="number" min="0" value={payroll[key as keyof typeof payroll]} onChange={(e) => setPayroll({ ...payroll, [key]: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-[#DEDAD5] p-3 text-sm font-bold"/></label>)}</div><button onClick={() => void savePayroll()} disabled={loading} className="mt-5 w-full rounded-xl bg-[#1A1917] p-3 text-xs font-black text-white">SIMPAN KOMPONEN PAYROLL</button></div></div>}
    </section>
  );
}
