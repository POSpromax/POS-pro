import type { SupabaseClient } from '@supabase/supabase-js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PERIOD_PATTERN = /^[0-9]{4}-(0[1-9]|1[0-2])$/;
const DATE_PATTERN = /^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
const MANAGEMENT_ROLES = new Set(['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN']);

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type NormalBalance = 'DEBIT' | 'CREDIT';

interface DefaultAccount {
  code: string;
  name: string;
  type: AccountType;
  normal: NormalBalance;
  system?: boolean;
}

// Bagan Akun standar UMKM F&B (Indonesia). is_system = akun inti yang dipakai
// posting otomatis sehingga tidak boleh dihapus.
const DEFAULT_COA: DefaultAccount[] = [
  // ASET (saldo normal debit)
  { code: '1-1000', name: 'Kas / Tunai', type: 'ASSET', normal: 'DEBIT', system: true },
  { code: '1-1100', name: 'Bank / QRIS / Non-Tunai', type: 'ASSET', normal: 'DEBIT', system: true },
  { code: '1-1200', name: 'Piutang Usaha', type: 'ASSET', normal: 'DEBIT' },
  { code: '1-1300', name: 'Persediaan Bahan Baku', type: 'ASSET', normal: 'DEBIT', system: true },
  { code: '1-1400', name: 'Piutang Kasbon Karyawan', type: 'ASSET', normal: 'DEBIT', system: true },
  { code: '1-1500', name: 'Peralatan & Perlengkapan', type: 'ASSET', normal: 'DEBIT' },
  // KEWAJIBAN (saldo normal kredit)
  { code: '2-1000', name: 'Utang Usaha', type: 'LIABILITY', normal: 'CREDIT' },
  { code: '2-1100', name: 'Utang Gaji', type: 'LIABILITY', normal: 'CREDIT', system: true },
  { code: '2-1200', name: 'Utang Pajak', type: 'LIABILITY', normal: 'CREDIT' },
  // MODAL (saldo normal kredit)
  { code: '3-1000', name: 'Modal Pemilik', type: 'EQUITY', normal: 'CREDIT', system: true },
  { code: '3-2000', name: 'Prive (Pengambilan Pemilik)', type: 'EQUITY', normal: 'DEBIT' },
  { code: '3-9000', name: 'Laba Ditahan', type: 'EQUITY', normal: 'CREDIT', system: true },
  // PENDAPATAN (saldo normal kredit)
  { code: '4-1000', name: 'Pendapatan Penjualan', type: 'REVENUE', normal: 'CREDIT', system: true },
  { code: '4-9000', name: 'Pendapatan Lain-lain', type: 'REVENUE', normal: 'CREDIT' },
  // BEBAN (saldo normal debit)
  { code: '5-1000', name: 'Harga Pokok Penjualan (HPP)', type: 'EXPENSE', normal: 'DEBIT', system: true },
  { code: '6-1000', name: 'Beban Gaji & Upah', type: 'EXPENSE', normal: 'DEBIT', system: true },
  { code: '6-2000', name: 'Beban Sewa', type: 'EXPENSE', normal: 'DEBIT' },
  { code: '6-3000', name: 'Beban Listrik & Air', type: 'EXPENSE', normal: 'DEBIT' },
  { code: '6-4000', name: 'Beban Gas', type: 'EXPENSE', normal: 'DEBIT' },
  { code: '6-5000', name: 'Beban Perlengkapan Operasional', type: 'EXPENSE', normal: 'DEBIT' },
  { code: '6-6000', name: 'Beban Pemasaran & Promosi', type: 'EXPENSE', normal: 'DEBIT' },
  { code: '6-7000', name: 'Beban Transportasi', type: 'EXPENSE', normal: 'DEBIT' },
  { code: '6-8000', name: 'Beban Administrasi & Bank', type: 'EXPENSE', normal: 'DEBIT' },
  { code: '6-9000', name: 'Beban Lain-lain', type: 'EXPENSE', normal: 'DEBIT' },
];

interface AccountingPayload {
  branchId?: string;
  action?: 'SEED_COA' | 'CREATE_ENTRY' | 'VOID_ENTRY';
  period?: string;
  entryDate?: string;
  description?: string;
  reference?: string;
  source?: string;
  sourceId?: string;
  lines?: Array<{ code?: string; debit?: number; credit?: number; memo?: string }>;
  entryId?: string;
}

export interface AccountingRequestResult { status: number; data: unknown }
const fail = (status: number, error: string): AccountingRequestResult => ({ status, data: { error } });

const currentPeriod = () => new Date().toISOString().slice(0, 7);

// Batas tanggal periode "YYYY-MM": awal, akhir, dan hari sebelum awal (saldo awal).
const periodBounds = (period: string) => {
  const [year, month] = period.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0)); // hari terakhir bulan
  const openingTo = new Date(Date.UTC(year, month - 1, 0)); // hari terakhir bulan sebelumnya
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end), openingTo: fmt(openingTo) };
};

async function resolveActor(payload: AccountingPayload, accessToken: string, admin: SupabaseClient) {
  const { data: authData, error: authError } = await admin.auth.getUser(accessToken);
  if (authError || !authData.user) return { error: fail(401, 'Sesi telah berakhir') as AccountingRequestResult };
  const actorId = authData.user.id;
  const [{ data: profile }, { data: membership }, { data: branch }] = await Promise.all([
    admin.from('user_profiles').select('tenant_id,is_active').eq('user_id', actorId).maybeSingle(),
    admin.from('branch_members').select('role,is_active').eq('user_id', actorId).eq('branch_id', payload.branchId).maybeSingle(),
    admin.from('branches').select('tenant_id,is_active').eq('id', payload.branchId).maybeSingle(),
  ]);
  if (!profile?.is_active || !membership?.is_active || !branch?.is_active || profile.tenant_id !== branch.tenant_id) {
    return { error: fail(403, 'Akun tidak memiliki akses ke outlet ini') as AccountingRequestResult };
  }
  if (!MANAGEMENT_ROLES.has(membership.role)) {
    return { error: fail(403, 'Hanya manajemen yang dapat mengakses akuntansi') as AccountingRequestResult };
  }
  return { actorId, tenantId: profile.tenant_id as string };
}

async function seedDefaultCoa(branchId: string, tenantId: string, admin: SupabaseClient) {
  const rows = DEFAULT_COA.map((account, index) => ({
    tenant_id: tenantId,
    branch_id: branchId,
    code: account.code,
    name: account.name,
    type: account.type,
    normal_balance: account.normal,
    is_system: account.system === true,
    sort_order: index,
  }));
  // Idempoten: hanya menambah akun yang belum ada (unik per branch_id + code).
  const { error } = await admin.from('chart_of_accounts').upsert(rows, { onConflict: 'branch_id,code', ignoreDuplicates: true });
  if (error) throw error;
}

export async function handleAccountingRequest(
  method: string,
  payload: AccountingPayload,
  accessToken: string,
  admin: SupabaseClient,
): Promise<AccountingRequestResult> {
  if (!['GET', 'POST'].includes(method)) return fail(405, 'Method not allowed');
  if (!accessToken) return fail(401, 'Sesi telah berakhir');
  if (!payload.branchId || !UUID_PATTERN.test(payload.branchId)) return fail(400, 'Outlet tidak valid');

  const actor = await resolveActor(payload, accessToken, admin);
  if ('error' in actor) return actor.error;
  const branchId = payload.branchId;

  if (method === 'GET') {
    const period = payload.period && PERIOD_PATTERN.test(payload.period) ? payload.period : currentPeriod();
    const { start, end, openingTo } = periodBounds(period);

    const [coaResult, entriesResult, openingResult] = await Promise.all([
      admin.from('chart_of_accounts').select('*').eq('branch_id', branchId).order('sort_order'),
      admin.from('journal_entries')
        .select('id,entry_date,reference,description,source,source_id,status,created_at,journal_lines(id,account_code,debit,credit,memo)')
        .eq('branch_id', branchId)
        .gte('entry_date', start)
        .lte('entry_date', end)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1000),
      admin.rpc('journal_account_balances', { p_branch_id: branchId, p_to: openingTo }),
    ]);

    if (coaResult.error) {
      if (coaResult.error.code === '42P01') return fail(503, 'Tabel akuntansi belum ada. Terapkan migrasi akuntansi di Supabase.');
      return fail(500, 'Bagan akun gagal dimuat');
    }
    if (entriesResult.error) return fail(500, 'Jurnal gagal dimuat');
    if (openingResult.error) return fail(500, 'Saldo awal gagal dihitung');

    const coa = (coaResult.data || []).map((row: any) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      type: row.type as AccountType,
      normalBalance: row.normal_balance as NormalBalance,
      parentCode: row.parent_code || undefined,
      isActive: row.is_active !== false,
      isSystem: row.is_system === true,
      sortOrder: row.sort_order ?? 0,
    }));

    const entries = (entriesResult.data || []).map((row: any) => ({
      id: row.id,
      entryDate: row.entry_date,
      reference: row.reference || '',
      description: row.description || '',
      source: row.source || 'MANUAL',
      sourceId: row.source_id || undefined,
      status: row.status || 'POSTED',
      createdAt: row.created_at,
      lines: (row.journal_lines || []).map((line: any) => ({
        id: line.id,
        accountCode: line.account_code,
        debit: Number(line.debit || 0),
        credit: Number(line.credit || 0),
        memo: line.memo || undefined,
      })),
    }));

    const openingBalances = (openingResult.data || []).map((row: any) => ({
      accountCode: row.account_code,
      debit: Number(row.total_debit || 0),
      credit: Number(row.total_credit || 0),
    }));

    return { status: 200, data: { canManage: true, period, coa, entries, openingBalances } };
  }

  // POST
  if (payload.action === 'SEED_COA') {
    try {
      await seedDefaultCoa(branchId, actor.tenantId, admin);
      return { status: 200, data: { ok: true } };
    } catch (error: any) {
      if (error?.code === '42P01') return fail(503, 'Tabel akuntansi belum ada. Terapkan migrasi akuntansi di Supabase.');
      return fail(500, 'Gagal menyiapkan bagan akun standar');
    }
  }

  if (payload.action === 'CREATE_ENTRY') {
    const entryDate = payload.entryDate;
    if (!entryDate || !DATE_PATTERN.test(entryDate)) return fail(400, 'Tanggal jurnal tidak valid');
    const lines = Array.isArray(payload.lines) ? payload.lines : [];
    const cleaned = lines
      .map((line) => ({
        code: String(line.code || '').trim(),
        debit: Math.round((Number(line.debit) || 0) * 100) / 100,
        credit: Math.round((Number(line.credit) || 0) * 100) / 100,
        memo: line.memo ? String(line.memo).slice(0, 200) : undefined,
      }))
      .filter((line) => line.code && (line.debit > 0 || line.credit > 0));
    if (cleaned.length < 2) return fail(400, 'Jurnal minimal 2 baris (debit dan kredit)');
    const totalDebit = cleaned.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = cleaned.reduce((sum, line) => sum + line.credit, 0);
    if (Math.round(totalDebit * 100) !== Math.round(totalCredit * 100)) {
      return fail(400, `Jurnal tidak seimbang: debit ${totalDebit} ≠ kredit ${totalCredit}`);
    }

    const { data, error } = await admin.rpc('post_journal_entry', {
      p_branch_id: branchId,
      p_entry_date: entryDate,
      p_reference: payload.reference ? String(payload.reference).slice(0, 60) : null,
      p_description: payload.description ? String(payload.description).slice(0, 300) : '',
      p_source: 'MANUAL',
      p_source_id: null,
      p_created_by: actor.actorId,
      p_lines: cleaned,
    });
    if (error) return fail(400, error.message || 'Jurnal gagal disimpan');
    return { status: 200, data: { ok: true, entryId: data } };
  }

  if (payload.action === 'VOID_ENTRY') {
    if (!payload.entryId || !UUID_PATTERN.test(payload.entryId)) return fail(400, 'Jurnal tidak valid');
    const { error } = await admin.from('journal_entries')
      .update({ status: 'VOID' })
      .eq('id', payload.entryId)
      .eq('branch_id', branchId);
    if (error) return fail(500, 'Jurnal gagal dibatalkan');
    return { status: 200, data: { ok: true } };
  }

  return fail(400, 'Aksi tidak dikenali');
}
