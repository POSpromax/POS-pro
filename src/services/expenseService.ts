import type { ExpenseIncomeRecord } from '../types/pos';
import { getSupabase } from '../lib/supabase';

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
  const supabase = getSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Sesi pengguna tidak valid');
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('tenant_id')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (profileError || !profile?.tenant_id) throw profileError || new Error('Tenant pengguna tidak ditemukan');
  const { data, error } = await supabase
    .from('expense_income_records')
    .insert({
      tenant_id: profile.tenant_id,
      branch_id: branchId,
      shift_id: record.shiftId || null,
      record_type: record.type,
      amount: record.amount,
      description: record.description,
      recorded_by: auth.user.id,
    })
    .select('id,shift_id,record_type,amount,description,recorded_by,created_at')
    .single();
  if (error) throw error;
  return mapExpense(data as ExpenseRow);
}
