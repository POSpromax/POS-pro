import { getSupabase } from '../lib/supabase';

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
  base_salary: number;
  meal_allowance: number;
  transport_allowance: number;
  overtime_hourly_rate: number;
  late_deduction_per_minute: number;
}

export interface HrData {
  canManage: boolean;
  leaveRequests: LeaveRequest[];
  payrollProfiles: PayrollProfile[];
}

async function requestHr(method: string, body: Record<string, unknown>): Promise<any> {
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sesi telah berakhir');
  const query = method === 'GET' ? `?${new URLSearchParams(body as Record<string, string>).toString()}` : '';
  const response = await fetch(`/api/hr${query}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(method === 'GET' ? {} : { 'Content-Type': 'application/json' }) },
    body: method === 'GET' ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Operasi HR gagal');
  return payload;
}

export const loadHrData = (branchId: string): Promise<HrData> => requestHr('GET', { branchId });
export const submitLeave = (payload: Record<string, unknown>) => requestHr('POST', { action: 'SUBMIT_LEAVE', ...payload });
export const reviewLeave = (payload: Record<string, unknown>) => requestHr('PATCH', { action: 'REVIEW_LEAVE', ...payload });
export const savePayrollProfile = (payload: Record<string, unknown>) => requestHr('PATCH', { action: 'SAVE_PAYROLL_PROFILE', ...payload });
