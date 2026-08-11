import type { Shift } from '../types/pos';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';

async function token(): Promise<string> {
  if (!isSupabaseConfigured()) return '';
  try {
    const { data } = await getSupabase().auth.getSession();
    return data.session?.access_token || '';
  } catch {
    return '';
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const accessToken = await token();
  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init?.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Layanan shift tidak dapat dihubungi');
  }
  return data as T;
}

export async function getCloudActiveShift(branchId: string): Promise<Shift | null> {
  if (!branchId) return null;
  const res = await request<{ shift: Shift | null }>(`/api/shifts?branchId=${encodeURIComponent(branchId)}`);
  return res.shift || null;
}

export async function openCloudShift(params: {
  branchId: string;
  staffId?: string;
  staffName?: string;
  staffRole?: string;
  initialCash?: number;
}): Promise<{ shift: Shift; alreadyOpen?: boolean }> {
  const res = await request<{ shift: Shift; alreadyOpen?: boolean }>('/api/shifts', {
    method: 'POST',
    body: JSON.stringify({
      action: 'OPEN',
      branchId: params.branchId,
      staffId: params.staffId,
      staffName: params.staffName,
      staffRole: params.staffRole,
      initialCash: params.initialCash || 0,
    }),
  });
  return res;
}

export async function closeCloudShift(params: {
  branchId: string;
  shiftId?: string;
  notes?: string;
  actualCash?: number;
  expectedCash?: number;
  varianceAmount?: number;
}): Promise<{ success: true; closedShiftId: string | null; closedAt: string | null }> {
  return request<{ success: true; closedShiftId: string | null; closedAt: string | null }>('/api/shifts', {
    method: 'POST',
    body: JSON.stringify({
      action: 'CLOSE',
      branchId: params.branchId,
      shiftId: params.shiftId,
      notes: params.notes || '',
      actualCash: params.actualCash,
      expectedCash: params.expectedCash,
      varianceAmount: params.varianceAmount,
    }),
  });
}

export function subscribeCloudShift(branchId: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured() || !branchId) return () => undefined;
  const supabase = getSupabase();
  let timer = 0;

  const notify = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(onChange, 300);
  };

  // Listen to Postgres Changes on cashier_shifts for this branch
  const dbChannel = supabase
    .channel(`branch:${branchId}:shift_db`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'cashier_shifts',
        filter: `branch_id=eq.${branchId}`,
      },
      notify,
    )
    .subscribe();

  return () => {
    window.clearTimeout(timer);
    void supabase.removeChannel(dbChannel);
  };
}
