import type { ExpenseIncomeRecord } from '../types/pos';
import { getSupabase } from '../lib/supabase';
import { getCloudTenantContext } from './tenantContextService';

interface ExpenseRow {
  id: string;
  shift_id: string | null;
  record_type: 'EXPENSE' | 'INCOME';
  amount: number;
  description: string;
  recorded_by: string | null;
  created_at: string;
}

const mapExpense = (row: ExpenseRow): ExpenseIncomeRecord => ({
  id: row.id,
  shiftId: row.shift_id || '',
  type: row.record_type,
  amount: Number(row.amount || 0),
  description: row.description || '',
  timestamp: row.created_at,
  recordedBy: row.recorded_by || '',
});

export async function listCloudExpenseRecords(
  branchId: string,
  shiftId?: string,
  from?: string,
  to?: string,
): Promise<ExpenseIncomeRecord[]> {
  let query = getSupabase()
    .from('expense_income_records')
    .select('id,shift_id,record_type,amount,description,recorded_by,created_at')
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false })
    .limit(500);
  if (shiftId) query = query.eq('shift_id', shiftId);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lt('created_at', to);
  const { data, error } = await query;
  if (error) throw error;
  return ((data || []) as ExpenseRow[]).map(mapExpense);
}

export async function saveCloudExpenseRecord(
  branchId: string,
  record: ExpenseIncomeRecord,
): Promise<ExpenseIncomeRecord> {
  const { supabase, tenantId, userId } = await getCloudTenantContext();
  const { data, error } = await supabase
    .from('expense_income_records')
    .insert({
      tenant_id: tenantId,
      branch_id: branchId,
      shift_id: record.shiftId || null,
      record_type: record.type,
      amount: record.amount,
      description: record.description,
      recorded_by: userId,
    })
    .select('id,shift_id,record_type,amount,description,recorded_by,created_at')
    .single();
  if (error) throw error;
  return mapExpense(data as ExpenseRow);
}
