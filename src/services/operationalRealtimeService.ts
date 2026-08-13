import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
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
  const notify = (message: { payload?: { table?: string } }) => {
    const table = message.payload?.table as OperationalTable | undefined;
    if (table) onChange(table);
  };
  const channel = supabase
    .channel(`branch:${branchId}:operations`, { config: { private: true } })
    .on('broadcast', { event: 'INSERT' }, notify)
    .on('broadcast', { event: 'UPDATE' }, notify)
    .on('broadcast', { event: 'DELETE' }, notify)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') onConnectionState?.('HEALTHY');
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') onConnectionState?.('DEGRADED');
      else onConnectionState?.('CONNECTING');
    });

  return () => { void supabase.removeChannel(channel); };
}
