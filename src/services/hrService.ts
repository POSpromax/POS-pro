import { getSupabase } from '../lib/supabase';

// ── Existing types ────────────────────────────────────────────────────────────

export interface LeaveRequest {
  id: string;
  user_id: string;
  staffName: string;
  leave_type: 'SICK' | 'PERMIT' | 'ANNUAL' | 'UNPAID';
  start_date: string;
  end_date: string;
  reason: string;
  attachment_url?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  review_note?: string;
  created_at: string;
}

export interface PayrollProfile {
  user_id: string;
  staffName: string;
  // Gaji flat bulanan — nominal tetap per bulan, tidak bergantung jumlah hari
  base_salary: number;
  meal_allowance: number;
  transport_allowance: number;
  overtime_hourly_rate: number;
  late_deduction_per_minute: number;
}

export interface HrLeaveReason {
  code: 'SICK' | 'PERMIT' | 'ANNUAL' | 'UNPAID';
  label: string;
  enabled: boolean;
  paid: boolean;
}

export interface HrConfig {
  leaveReasons: HrLeaveReason[];
  latePenaltyGraceMinutes: number;
  workingDays: number[];
}

// ── Kasbon (pinjaman gaji di muka) ───────────────────────────────────────────

export type KasbonStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';

export interface KasbonRecord {
  id: string;
  user_id: string;
  staffName: string;
  branch_id: string;
  amount: number;                  // Nominal kasbon
  reason: string;                  // Keterangan pengajuan
  status: KasbonStatus;
  requested_at: string;            // ISO datetime
  reviewed_by?: string;            // user_id reviewer
  reviewed_at?: string;
  review_note?: string;
  deduct_month?: string;           // Format "YYYY-MM" — bulan potongan (default: bulan berikutnya)
  deducted_at?: string;            // Saat sudah dipotong dari slip gaji
}

// ── Slip gaji yang sudah dikalkulasi ─────────────────────────────────────────

export interface PayslipData {
  staffId: string;
  staffName: string;
  phone?: string;
  period: string;               // Format "YYYY-MM"
  periodLabel: string;          // Format "Januari 2025"
  baseSalary: number;
  mealAllowance: number;
  transportAllowance: number;
  overtimeMinutes: number;
  overtimePay: number;
  grossSalary: number;          // base + meal + transport + overtime
  lateDeduction: number;        // Potongan keterlambatan (dari attendance)
  kasbonDeduction: number;      // Kasbon yang dipotong bulan ini
  totalDeduction: number;       // lateDeduction + kasbonDeduction
  netSalary: number;            // grossSalary - totalDeduction
  lateMinutes: number;          // Total menit terlambat dalam periode
  attendanceCount: number;      // Jumlah hari hadir
  notes?: string;
}


export type PayrollPeriodStatus = 'DRAFT' | 'FINALIZED' | 'PAID' | 'LOCKED';

export interface PayrollPeriodRecord {
  id: string;
  branch_id: string;
  period: string;
  status: PayrollPeriodStatus;
  finalized_at?: string;
  paid_at?: string;
  locked_at?: string;
  updated_at?: string;
}

export interface PayrollSnapshotRecord {
  id: string;
  branch_id: string;
  payroll_period_id: string;
  period: string;
  user_id: string;
  staff_name: string;
  base_salary: number;
  meal_allowance: number;
  transport_allowance: number;
  overtime_minutes: number;
  overtime_pay: number;
  gross_salary: number;
  attendance_count: number;
  late_minutes: number;
  late_deduction: number;
  kasbon_deduction: number;
  manual_adjustment: number;
  total_deduction: number;
  net_salary: number;
  calculation_meta?: Record<string, unknown>;
}

export interface HrData {
  canManage: boolean;
  leaveRequests: LeaveRequest[];
  payrollProfiles: PayrollProfile[];
  kasbonRecords?: KasbonRecord[];
  hrConfig?: HrConfig;
  payrollPeriods?: PayrollPeriodRecord[];
  payrollSnapshots?: PayrollSnapshotRecord[];
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function requestHr(method: string, body: Record<string, unknown>): Promise<any> {
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sesi telah berakhir');
  const query = method === 'GET' ? `?${new URLSearchParams(body as Record<string, string>).toString()}` : '';
  const response = await fetch(`/api/hr${query}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(method === 'GET' ? {} : { 'Content-Type': 'application/json' }),
    },
    body: method === 'GET' ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Operasi HR gagal');
  return payload;
}

// ── Existing endpoints ────────────────────────────────────────────────────────

export const loadHrData = (branchId: string, period?: string): Promise<HrData> =>
  requestHr('GET', { branchId, ...(period ? { period } : {}) });

export const submitLeave = (payload: Record<string, unknown>) =>
  requestHr('POST', { action: 'SUBMIT_LEAVE', ...payload });

export const reviewLeave = (payload: Record<string, unknown>) =>
  requestHr('PATCH', { action: 'REVIEW_LEAVE', ...payload });

export const savePayrollProfile = (payload: Record<string, unknown>) =>
  requestHr('PATCH', { action: 'SAVE_PAYROLL_PROFILE', ...payload });

export const saveHrConfig = (payload: Record<string, unknown>) =>
  requestHr('PATCH', { action: 'SAVE_HR_CONFIG', ...payload });

// ── Kasbon endpoints ──────────────────────────────────────────────────────────

export const requestKasbon = (payload: {
  branchId: string;
  userId?: string;
  amount: number;
  reason: string;
  deductMonth?: string;
}) => requestHr('POST', { action: 'REQUEST_KASBON', ...payload });

export const reviewKasbon = (payload: {
  branchId: string;
  kasbonId: string;
  status: 'APPROVED' | 'REJECTED';
  reviewNote?: string;
}) => requestHr('PATCH', { action: 'REVIEW_KASBON', ...payload });

export const deductKasbon = (payload: {
  branchId: string;
  kasbonId: string;
}) => requestHr('PATCH', { action: 'DEDUCT_KASBON', ...payload });


export const finalizePayrollPeriod = (payload: { branchId: string; period: string }) =>
  requestHr('PATCH', { action: 'FINALIZE_PAYROLL_PERIOD', ...payload });

export const markPayrollPaid = (payload: { branchId: string; period: string }) =>
  requestHr('PATCH', { action: 'MARK_PAYROLL_PAID', ...payload });

export const lockPayrollPeriod = (payload: { branchId: string; period: string }) =>
  requestHr('PATCH', { action: 'LOCK_PAYROLL_PERIOD', ...payload });

// ── Payslip kalkulasi (local — tidak memerlukan API call) ─────────────────────

export function calculatePayslip(params: {
  profile: PayrollProfile;
  staffId: string;
  staffName: string;
  phone?: string;
  period: string;              // "YYYY-MM"
  lateMinutes: number;
  attendanceCount: number;
  kasbonDeduction: number;
  overtimeMinutes?: number;
  overtimePay?: number;
  notes?: string;
}): PayslipData {
  const { profile, period, lateMinutes, kasbonDeduction } = params;

  // Format label periode (mis. "2025-01" → "Januari 2025")
  const [yr, mo] = period.split('-').map(Number);
  const periodLabel = new Date(yr, mo - 1, 1).toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  });

  const mealAllowance = profile.meal_allowance ?? 0;
  const transportAllowance = profile.transport_allowance ?? 0;
  const overtimeMinutes = Math.max(0, Math.round(params.overtimeMinutes ?? 0));
  const overtimePay = Math.max(0, Math.round(params.overtimePay ?? 0));
  const grossSalary = (profile.base_salary ?? 0) + mealAllowance + transportAllowance + overtimePay;
  const lateDeduction = Math.round(lateMinutes * (profile.late_deduction_per_minute ?? 0));
  const totalDeduction = lateDeduction + (kasbonDeduction ?? 0);
  const netSalary = Math.max(0, grossSalary - totalDeduction);

  return {
    staffId: params.staffId,
    staffName: params.staffName,
    phone: params.phone,
    period,
    periodLabel,
    baseSalary: profile.base_salary ?? 0,
    mealAllowance,
    transportAllowance,
    overtimeMinutes,
    overtimePay,
    grossSalary,
    lateDeduction,
    kasbonDeduction: kasbonDeduction ?? 0,
    totalDeduction,
    netSalary,
    lateMinutes,
    attendanceCount: params.attendanceCount,
    notes: params.notes,
  };
}

// ── WhatsApp slip formatter ───────────────────────────────────────────────────

const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

export function buildWhatsAppSlipText(
  slip: PayslipData,
  outletName: string,
): string {
  return [
    `*SLIP GAJI — ${outletName.toUpperCase()}*`,
    `Periode: *${slip.periodLabel}*`,
    `Karyawan: ${slip.staffName}`,
    ``,
    `*PENDAPATAN*`,
    `Gaji Pokok       : ${rp(slip.baseSalary)}`,
    slip.mealAllowance > 0 ? `Tunjangan Makan  : ${rp(slip.mealAllowance)}` : null,
    slip.transportAllowance > 0 ? `Tunjangan Trans. : ${rp(slip.transportAllowance)}` : null,
    slip.overtimePay > 0 ? `Lembur           : ${rp(slip.overtimePay)} (${slip.overtimeMinutes} mnt)` : null,
    `Gaji Kotor       : *${rp(slip.grossSalary)}*`,
    ``,
    `*POTONGAN*`,
    slip.lateDeduction > 0 ? `Keterlambatan    : -${rp(slip.lateDeduction)} (${slip.lateMinutes} mnt)` : null,
    slip.kasbonDeduction > 0 ? `Kasbon           : -${rp(slip.kasbonDeduction)}` : null,
    slip.totalDeduction === 0 ? `(tidak ada potongan)` : null,
    ``,
    `*TOTAL GAJI BERSIH: ${rp(slip.netSalary)}*`,
    slip.notes ? `\nCatatan: ${slip.notes}` : null,
    `\n_Terima kasih sudah bekerja keras!_ 🙏`,
  ]
    .filter((line) => line !== null)
    .join('\n');
}

export function buildWhatsAppSlipUrl(slip: PayslipData, outletName: string): string {
  const text = buildWhatsAppSlipText(slip, outletName);
  const phone = slip.phone
    ? slip.phone.replace(/\D/g, '').replace(/^0/, '62')
    : '';
  return phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
}