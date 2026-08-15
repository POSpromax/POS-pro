import { ensureRealtimeAuth, getSupabase, isSupabaseConfigured } from '../lib/supabase';
import type { RealtimeConnectionState } from './orderService';

export type OperationalTable =
  | 'restaurant_tables'
  | 'menu_items'
  | 'menu_item_ingredients'
  | 'raw_materials'
  | 'condiment_groups'
  | 'condiment_options'
  | 'branch_operational_config'
  | 'expense_income_records';

export function subscribeBranchOperations(
  branchId: string,
  onChange: (table: OperationalTable) => void,
  onConnectionState?: (state: RealtimeConnectionState) => void,
): () => void {
  if (!branchId || !isSupabaseConfigured()) return () => undefined;

  const supabase = getSupabase();
  let disposed = false;
  let channel: ReturnType<typeof supabase.channel> | null = null;

  const notify = (message: { payload?: { table?: string } }) => {
    const table = message.payload?.table as OperationalTable | undefined;
    if (table) onChange(table);
  };

  onConnectionState?.('CONNECTING');

  void ensureRealtimeAuth()
    .then(() => {
      if (disposed) return;
      channel = supabase
        .channel(`branch:${branchId}:operations`, { config: { private: true } })
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
    if (channel) void supabase.removeChannel(channel);
  };
}
