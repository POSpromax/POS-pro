import type { Shift } from '../types/pos';
import { ensureRealtimeAuth, getSupabase, isSupabaseConfigured } from '../lib/supabase';
import type { RealtimeConnectionState } from './orderService';

export class ShiftServiceError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ShiftServiceError';
  }
}

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
    throw new ShiftServiceError(data.error || 'Layanan shift tidak dapat dihubungi', response.status);
  }
  return data as T;
}

export async function getCloudActiveShift(branchId: string): Promise<Shift | null> {
  if (!branchId) return null;
  const res = await request<{ shift: Shift | null }>(`/api/shifts?branchId=${encodeURIComponent(branchId)}`);
  return res.shift || null;
}

export async function listCloudShiftHistory(branchId: string): Promise<Shift[]> {
  if (!branchId) return [];
  const res = await request<{ shifts: Shift[] }>(`/api/shifts?branchId=${encodeURIComponent(branchId)}&history=true`);
  return res.shifts || [];
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

export function subscribeCloudShift(
  branchId: string,
  onChange: () => void,
  onConnectionState?: (state: RealtimeConnectionState) => void,
): () => void {
  if (!isSupabaseConfigured() || !branchId) return () => undefined;
  const supabase = getSupabase();
  let timer = 0;
  let disposed = false;
  let dbChannel: ReturnType<typeof supabase.channel> | null = null;

  const notify = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(onChange, 220);
  };

  onConnectionState?.('CONNECTING');

  void ensureRealtimeAuth()
    .then(() => {
      if (disposed) return;
      dbChannel = supabase
        .channel(`branch:${branchId}:shift`, { config: { private: true } })
        .on('broadcast', { event: 'INSERT' }, notify)
        .on('broadcast', { event: 'UPDATE' }, notify)
        .on('broadcast', { event: 'DELETE' }, notify)
        .subscribe((status) => {
          if (disposed) return;
          if (status === 'SUBSCRIBED') onConnectionState?.('HEALTHY');
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') onConnectionState?.('DEGRADED');
          else onConnectionState?.('CONNECTING');
        });
    })
    .catch(() => {
      if (!disposed) onConnectionState?.('DEGRADED');
    });

  return () => {
    disposed = true;
    window.clearTimeout(timer);
    if (dbChannel) void supabase.removeChannel(dbChannel);
  };
}
