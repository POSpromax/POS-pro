import { getSupabase } from '../lib/supabase';

export interface TransactionPurgeResult {
  branchId: string;
  orderCount: number;
  paymentCount: number;
  eventCount: number;
  totalAmountPurged: number;
}

/**
 * Owner-only: permanently delete completed/cancelled order history older
 * than `retentionDays` for one branch. Requires typing the exact branch
 * name as a last-resort confirmation. Master data (menu, staff, tables,
 * stock ledger) is never affected — see purge_completed_orders() RPC.
 */
export async function purgeCompletedOrders(
  branchId: string,
  retentionDays: number,
  confirmBranchName: string,
): Promise<TransactionPurgeResult> {
  const { data } = await getSupabase().auth.getSession();
  const response = await fetch('/api/transaction-purge', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
    },
    body: JSON.stringify({ branchId, retentionDays, confirmBranchName }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result?.error || 'Purge transaksi gagal diproses');
  }
  return {
    branchId: result.branch_id,
    orderCount: Number(result.order_count || 0),
    paymentCount: Number(result.payment_count || 0),
    eventCount: Number(result.event_count || 0),
    totalAmountPurged: Number(result.total_amount_purged || 0),
  };
}
