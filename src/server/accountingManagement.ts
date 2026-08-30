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
  { code: '6-1100', name: 'Beban Konsumsi Karyawan', type: 'EXPENSE', normal: 'DEBIT', system: true },
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
  action?: 'SEED_COA' | 'CREATE_ENTRY' | 'UPDATE_ENTRY' | 'VOID_ENTRY' | 'DELETE_ENTRY' | 'SAVE_ACCOUNT' | 'DELETE_ACCOUNT'
    | 'DISMISS_RECOMMENDATION' | 'RESTORE_RECOMMENDATION' | 'ARCHIVE_DISMISSAL';
  view?: string;
  // scope=ALL: laporan KONSOLIDASI seluruh cabang yang boleh diakses aktor
  // (hanya untuk BACA; pembuatan/edit jurnal tetap per cabang agar aman).
  scope?: string;
  period?: string;
  entryDate?: string;
  description?: string;
  reference?: string;
  source?: string;
  sourceId?: string;
  lines?: Array<{ code?: string; debit?: number; credit?: number; memo?: string }>;
  entryId?: string;
  account?: { id?: string; code?: string; name?: string; type?: string; normalBalance?: string };
  accountId?: string;
  // Cuplikan rekomendasi yang diabaikan, disimpan agar riwayat tetap terbaca
  // walau rekomendasinya tidak lagi dihasilkan ulang.
  kind?: string;
  title?: string;
  amount?: number;
  date?: string;
}

const ACCOUNT_TYPES = new Set(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']);
const naturalBalance = (type: string): NormalBalance => (type === 'ASSET' || type === 'EXPENSE' ? 'DEBIT' : 'CREDIT');

// Rapikan & validasi baris jurnal (dipakai CREATE & UPDATE).
// error terisi bila tidak valid; jika error kosong, lines siap dipakai.
function cleanLines(rawLines: unknown): { error?: string; lines: Array<{ code: string; debit: number; credit: number; memo?: string }> } {
  const lines = Array.isArray(rawLines) ? rawLines : [];
  const cleaned = lines
    .map((line: any) => ({
      code: String(line.code || '').trim(),
      debit: Math.round((Number(line.debit) || 0) * 100) / 100,
      credit: Math.round((Number(line.credit) || 0) * 100) / 100,
      memo: line.memo ? String(line.memo).slice(0, 200) : undefined,
    }))
    .filter((line) => line.code && (line.debit > 0 || line.credit > 0));
  if (cleaned.length < 2) return { error: 'Jurnal minimal 2 baris (debit dan kredit)', lines: [] };
  const totalDebit = cleaned.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = cleaned.reduce((sum, line) => sum + line.credit, 0);
  if (Math.round(totalDebit * 100) !== Math.round(totalCredit * 100)) {
    return { error: `Jurnal tidak seimbang: debit ${totalDebit} ≠ kredit ${totalCredit}`, lines: [] };
  }
  return { lines: cleaned };
}

const POSTABLE_SOURCES = new Set(['MANUAL', 'SALES', 'EXPENSE', 'PAYROLL', 'INVENTORY', 'ADJUSTMENT', 'OPENING']);

// Peta kata kunci keterangan biaya -> kode akun beban. Default 6-9000 (lain-lain);
// pengguna tetap bisa menyesuaikan akun saat mengonfirmasi rekomendasi.
const EXPENSE_ACCOUNT_RULES: Array<{ re: RegExp; code: string }> = [
  // Bahan baku / belanja dapur -> HPP. Didahulukan karena paling sering dipakai
  // dan namanya sering berupa nama makanan/bahan langsung.
  { re: /belanja|bahan|stok|supplier|pasar|sayur|daging|ayam|sapi|bakso|mie|tahu|telur|bumbu|beras|minyak|gula|garam|kecap|saus|cabe|cabai|bawang|kol|sawi|seledri|penyet|es batu|susu|kopi|teh|sirup|buah|durian|alpukat/i, code: '5-1000' },
  { re: /gas|lpg|elpiji|tabung/i, code: '6-4000' },
  { re: /listrik|token|pln|air|pdam|galon/i, code: '6-3000' },
  { re: /sewa|kontrak|ruko|kios/i, code: '6-2000' },
  { re: /gaji|upah|bonus|thr|lembur|kasbon/i, code: '6-1000' },
  { re: /transport|bensin|solar|ongkir|kirim|parkir|tol|grab|gojek|angkut/i, code: '6-7000' },
  { re: /promo|iklan|marketing|pemasaran|spanduk|banner|endorse|brosur/i, code: '6-6000' },
  { re: /admin|bank|transfer|biaya app|langganan|internet|pulsa|wifi/i, code: '6-8000' },
  { re: /perlengkapan|plastik|kemasan|tisu|sabun|alat|sendok|sedotan|kertas|gelas|mangkok|pembersih|sapu|servis|perbaikan/i, code: '6-5000' },
];
const mapExpenseAccount = (description: string): string => {
  const found = EXPENSE_ACCOUNT_RULES.find((rule) => rule.re.test(description || ''));
  return found ? found.code : '6-9000';
};

const addDays = (dateKey: string, delta: number) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
};

const localDateKey = (iso: string, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso));
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
};

export interface JournalRecommendation {
  id: string;
  kind: 'SALES' | 'EXPENSE' | 'INCOME' | 'PAYROLL' | 'STAFF_MEAL' | 'INVENTORY';
  source: string;
  sourceId: string;
  date: string;
  title: string;
  amount: number;
  lines: Array<{ code: string; debit: number; credit: number }>;
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
    admin.from('branches').select('tenant_id,is_active,timezone').eq('id', payload.branchId).maybeSingle(),
  ]);
  if (!profile?.is_active || !membership?.is_active || !branch?.is_active || profile.tenant_id !== branch.tenant_id) {
    return { error: fail(403, 'Akun tidak memiliki akses ke outlet ini') as AccountingRequestResult };
  }
  if (!MANAGEMENT_ROLES.has(membership.role)) {
    return { error: fail(403, 'Hanya manajemen yang dapat mengakses akuntansi') as AccountingRequestResult };
  }
  return { actorId, tenantId: profile.tenant_id as string, timeZone: (branch.timezone as string) || 'Asia/Jakarta' };
}


/** Cabang (dalam tenant yang sama) tempat aktor menjabat peran manajemen aktif. */
async function managedBranchIds(actorId: string, tenantId: string, admin: SupabaseClient): Promise<Array<{ id: string; name: string }>> {
  const { data: memberships } = await admin
    .from('branch_members')
    .select('branch_id,role,is_active')
    .eq('user_id', actorId)
    .eq('is_active', true);
  const ids = (memberships || [])
    .filter((row: any) => MANAGEMENT_ROLES.has(row.role))
    .map((row: any) => row.branch_id);
  if (!ids.length) return [];
  const { data: branches } = await admin
    .from('branches')
    .select('id,name')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .in('id', ids);
  return (branches || []).map((b: any) => ({ id: b.id, name: b.name }));
}
// Menyusun rekomendasi jurnal dari transaksi yang BELUM dijurnal pada periode:
// penjualan (agregat per hari), biaya/pemasukan (per catatan), gaji (per periode).
async function buildRecommendations(
  branchId: string,
  period: string,
  timeZone: string,
  admin: SupabaseClient,
): Promise<JournalRecommendation[]> {
  const { start, end } = periodBounds(period);
  const rangeFrom = `${addDays(start, -1)}T00:00:00.000Z`;
  const rangeTo = `${addDays(end, 1)}T23:59:59.999Z`;

  const [postedRes, ordersRes, expenseRes, payrollRes] = await Promise.all([
    admin.from('journal_entries').select('source_id').eq('branch_id', branchId).eq('status', 'POSTED').not('source_id', 'is', null),
    admin.from('orders').select('id,created_at,payment_method,total_amount,subtotal_amount,discount_amount')
      .eq('branch_id', branchId).eq('payment_status', 'PAID').neq('status', 'CANCELLED')
      .gte('created_at', rangeFrom).lte('created_at', rangeTo),
    admin.from('expense_income_records').select('id,record_type,amount,description,created_at')
      .eq('branch_id', branchId).gte('created_at', rangeFrom).lte('created_at', rangeTo),
    admin.from('payroll_snapshots').select('net_salary,staff_name').eq('branch_id', branchId).eq('period', period),
  ]);

  const posted = new Set((postedRes.data || []).map((r: any) => r.source_id));
  // Rekomendasi yang pernah DIABAIKAN diperlakukan sama seperti yang sudah
  // diposting: tidak ditawarkan lagi. Bedanya, pengabaian bisa dibatalkan lewat
  // RESTORE_RECOMMENDATION sehingga rekomendasinya muncul kembali.
  const { data: dismissedRows } = await admin
    .from('journal_recommendation_dismissals')
    .select('source_id')
    .eq('branch_id', branchId);
  (dismissedRows || []).forEach((row: any) => posted.add(row.source_id));
  const recommendations: JournalRecommendation[] = [];

  // 1) Penjualan agregat per hari (dalam bulan periode).
  const byDay = new Map<string, { cash: number; nonCash: number }>();
  (ordersRes.data || []).forEach((row: any) => {
    const dateKey = localDateKey(row.created_at, timeZone);
    if (dateKey.slice(0, 7) !== period) return;
    const total = Number(row.total_amount || 0);
    if (total <= 0) return;
    const method = String(row.payment_method || 'CASH').toUpperCase();
    const bucket = byDay.get(dateKey) || { cash: 0, nonCash: 0 };
    if (method === 'CASH' || method === '') bucket.cash += total;
    else bucket.nonCash += total;
    byDay.set(dateKey, bucket);
  });
  [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([dateKey, sums]) => {
    const sourceId = `SALES:${dateKey}`;
    if (posted.has(sourceId)) return;
    const total = sums.cash + sums.nonCash;
    if (total <= 0) return;
    const lines: JournalRecommendation['lines'] = [];
    if (sums.cash > 0) lines.push({ code: '1-1000', debit: sums.cash, credit: 0 });
    if (sums.nonCash > 0) lines.push({ code: '1-1100', debit: sums.nonCash, credit: 0 });
    lines.push({ code: '4-1000', debit: 0, credit: total });
    recommendations.push({
      id: sourceId, kind: 'SALES', source: 'SALES', sourceId, date: dateKey,
      title: `Penjualan ${new Date(`${dateKey}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}`,
      amount: total, lines,
    });
  });

  // 2) Biaya & pemasukan operasional (per catatan).
  (expenseRes.data || []).forEach((row: any) => {
    const dateKey = localDateKey(row.created_at, timeZone);
    if (dateKey.slice(0, 7) !== period) return;
    const amount = Number(row.amount || 0);
    if (amount <= 0) return;
    if (row.record_type === 'EXPENSE') {
      const sourceId = `EXPENSE:${row.id}`;
      if (posted.has(sourceId)) return;
      const account = mapExpenseAccount(row.description || '');
      recommendations.push({
        id: sourceId, kind: 'EXPENSE', source: 'EXPENSE', sourceId, date: dateKey,
        title: row.description || 'Beban operasional', amount,
        lines: [{ code: account, debit: amount, credit: 0 }, { code: '1-1000', debit: 0, credit: amount }],
      });
    } else if (row.record_type === 'INCOME') {
      const sourceId = `INCOME:${row.id}`;
      if (posted.has(sourceId)) return;
      recommendations.push({
        id: sourceId, kind: 'INCOME', source: 'EXPENSE', sourceId, date: dateKey,
        title: row.description || 'Pemasukan lain', amount,
        lines: [{ code: '1-1000', debit: amount, credit: 0 }, { code: '4-9000', debit: 0, credit: amount }],
      });
    }
  });

  // Makan staff SENGAJA tidak ditawarkan sebagai rekomendasi. Order berdiskon
  // 100% tetap memotong stok lewat deduct_order_inventory seperti penjualan biasa,
  // sehingga biayanya SUDAH tercermin otomatis pada penurunan nilai persediaan.
  // Menjurnalnya lagi berarti menghitung biaya yang sama dua kali.

  // 3) Gaji: agregat snapshot payroll periode ini (kredit Kas).
  const snaps = payrollRes.data || [];
  if (snaps.length > 0) {
    const sourceId = `PAYROLL:${period}`;
    if (!posted.has(sourceId)) {
      const totalNet = snaps.reduce((sum: number, s: any) => sum + Number(s.net_salary || 0), 0);
      if (totalNet > 0) {
        const [yr, mo] = period.split('-').map(Number);
        const payDate = new Date(Date.UTC(yr, mo, 0)).toISOString().slice(0, 10);
        recommendations.push({
          id: sourceId, kind: 'PAYROLL', source: 'PAYROLL', sourceId, date: payDate,
          title: `Gaji ${new Date(yr, mo - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })} (${snaps.length} staff)`,
          amount: totalNet,
          lines: [{ code: '6-1000', debit: totalNet, credit: 0 }, { code: '1-1000', debit: 0, credit: totalNet }],
        });
      }
    }
  }

  // Persediaan bahan baku SENGAJA tidak ditawarkan sebagai rekomendasi: nilainya
  // disinkronkan langsung dari stok nyata dapur (lihat inventoryAssetValue), jadi
  // tidak perlu dikonfirmasi manual tiap hari.

  // TERBARU DI ATAS. Sebelumnya penjualan diurut menaik sehingga tiap ganti hari
  // daftarnya selalu dibuka dari awal bulan, seolah mengulang dari nol. Hari yang
  // belum diposting tetap ada di bawah -- tidak disembunyikan, karena itu memang
  // pekerjaan yang belum selesai.
  return recommendations.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
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

    if (payload.view === 'recommendations') {
      try {
        const recommendations = await buildRecommendations(branchId, period, actor.timeZone, admin);
        // Riwayat pengabaian ikut dikirim supaya pengguna bisa melihat apa yang
        // pernah ditolak dan memanggilnya kembali sewaktu-waktu.
        const { data: dismissedHistory } = await admin
          .from('journal_recommendation_dismissals')
          .select('source_id,kind,title,amount,entry_date,dismissed_at')
          .eq('branch_id', branchId)
          .is('archived_at', null)
          .order('dismissed_at', { ascending: false })
          .limit(100);
        return {
          status: 200,
          data: {
            period,
            recommendations,
            dismissed: (dismissedHistory || []).map((row: any) => ({
              sourceId: row.source_id,
              kind: row.kind,
              title: row.title,
              amount: Number(row.amount || 0),
              date: row.entry_date || undefined,
              dismissedAt: row.dismissed_at,
            })),
          },
        };
      } catch (error: any) {
        if (error?.code === '42P01') return fail(503, 'Tabel akuntansi belum ada. Terapkan migrasi akuntansi di Supabase.');
        return fail(500, 'Rekomendasi jurnal gagal dihitung');
      }
    }

    const { start, end, openingTo } = periodBounds(period);
    // KONSOLIDASI: scope=ALL membaca seluruh cabang yang dikelola aktor.
    // Hanya untuk BACA; pembuatan/edit jurnal tetap terikat satu cabang.
    const consolidated = String(payload.scope || '').toUpperCase() === 'ALL';
    const branchList = consolidated
      ? await managedBranchIds(actor.actorId, actor.tenantId, admin)
      : [{ id: branchId, name: '' }];
    const branchIds = branchList.map((b) => b.id);
    if (branchIds.length === 0) return fail(403, 'Tidak ada outlet yang dapat Anda akses');


    const [coaResult, entriesResult, openingResult] = await Promise.all([
      admin.from('chart_of_accounts').select('*').in('branch_id', branchIds).order('sort_order'),
      admin.from('journal_entries')
        .select('id,entry_date,reference,description,source,source_id,status,created_at,journal_lines(id,account_code,debit,credit,memo)')
        .eq('branch_id', branchId)
        .gte('entry_date', start)
        .lte('entry_date', end)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1000),
      Promise.all(branchIds.map((id) => admin.rpc('journal_account_balances', { p_branch_id: id, p_to: openingTo })))
        .then((results) => ({
          data: results.flatMap((r: any) => r.data || []),
          error: results.find((r: any) => r.error)?.error || null,
        })),
    ]);

    if (coaResult.error) {
      if (coaResult.error.code === '42P01') return fail(503, 'Tabel akuntansi belum ada. Terapkan migrasi akuntansi di Supabase.');
      return fail(500, 'Bagan akun gagal dimuat');
    }
    if (entriesResult.error) return fail(500, 'Jurnal gagal dimuat');
    if (openingResult.error) return fail(500, 'Saldo awal gagal dihitung');

    // Konsolidasi: akun berkode sama di beberapa cabang digabung jadi satu baris.
    const seenCodes = new Set<string>();
    const coa = (coaResult.data || []).filter((row: any) => {
      if (!consolidated) return true;
      if (seenCodes.has(row.code)) return false;
      seenCodes.add(row.code);
      return true;
    }).map((row: any) => ({
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

    // Saldo awal dari beberapa cabang dijumlahkan per kode akun.
    const openingMap = new Map<string, { debit: number; credit: number }>();
    (openingResult.data || []).forEach((row: any) => {
      const bucket = openingMap.get(row.account_code) || { debit: 0, credit: 0 };
      bucket.debit += Number(row.total_debit || 0);
      bucket.credit += Number(row.total_credit || 0);
      openingMap.set(row.account_code, bucket);
    });
    const openingBalances = [...openingMap.entries()].map(([accountCode, v]) => ({
      accountCode, debit: v.debit, credit: v.credit,
    }));

    // NILAI PERSEDIAAN HIDUP, disinkronkan langsung dari stok dapur.
    // Pembelian bahan dibebankan ke HPP saat dibeli, sehingga buku besar tidak
    // pernah mencatat persediaan. Menghitungnya di sini membuat aset itu tampil
    // apa adanya tanpa perlu jurnal penyesuaian manual setiap hari, dan otomatis
    // ikut turun saat stok terpakai -- termasuk oleh order makan staff.
    const inventoryBranchIds = consolidated ? branchList.map((b: any) => b.id) : [branchId];
    const { data: stockRows } = await admin
      .from('raw_materials')
      .select('stock_quantity,cost_per_unit')
      .in('branch_id', inventoryBranchIds);
    const inventoryAsset = Math.round((stockRows || []).reduce((sum: number, row: any) => (
      sum + Number(row.stock_quantity || 0) * Number(row.cost_per_unit || 0)
    ), 0));

    return { status: 200, data: { canManage: true, period, coa, entries, openingBalances, consolidated, branches: branchList, inventoryAsset } };
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
    const parsed = cleanLines(payload.lines);
    if (parsed.error) return fail(400, parsed.error);

    // Sumber posting: MANUAL (default) atau hasil konfirmasi rekomendasi
    // (SALES/EXPENSE/PAYROLL/...). sourceId dipakai mencegah posting ganda.
    const source = payload.source && POSTABLE_SOURCES.has(payload.source) ? payload.source : 'MANUAL';
    const sourceId = source !== 'MANUAL' && payload.sourceId ? String(payload.sourceId).slice(0, 80) : null;
    if (sourceId) {
      const { data: existing } = await admin.from('journal_entries')
        .select('id').eq('branch_id', branchId).eq('source_id', sourceId).eq('status', 'POSTED').limit(1);
      if (existing && existing.length > 0) return fail(409, 'Transaksi ini sudah pernah diposting ke jurnal.');
    }

    const { data, error } = await admin.rpc('post_journal_entry', {
      p_branch_id: branchId,
      p_entry_date: entryDate,
      p_reference: payload.reference ? String(payload.reference).slice(0, 60) : null,
      p_description: payload.description ? String(payload.description).slice(0, 300) : '',
      p_source: source,
      p_source_id: sourceId,
      p_created_by: actor.actorId,
      p_lines: parsed.lines,
    });
    if (error) return fail(400, error.message || 'Jurnal gagal disimpan');
    return { status: 200, data: { ok: true, entryId: data } };
  }

  if (payload.action === 'UPDATE_ENTRY') {
    if (!payload.entryId || !UUID_PATTERN.test(payload.entryId)) return fail(400, 'Jurnal tidak valid');
    const entryDate = payload.entryDate;
    if (!entryDate || !DATE_PATTERN.test(entryDate)) return fail(400, 'Tanggal jurnal tidak valid');
    const parsed = cleanLines(payload.lines);
    if (parsed.error) return fail(400, parsed.error);
    const { error } = await admin.rpc('update_journal_entry', {
      p_entry_id: payload.entryId,
      p_branch_id: branchId,
      p_entry_date: entryDate,
      p_reference: payload.reference ? String(payload.reference).slice(0, 60) : null,
      p_description: payload.description ? String(payload.description).slice(0, 300) : '',
      p_lines: parsed.lines,
    });
    if (error) return fail(400, error.message || 'Jurnal gagal diperbarui');
    return { status: 200, data: { ok: true } };
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

  if (payload.action === 'DELETE_ENTRY') {
    if (!payload.entryId || !UUID_PATTERN.test(payload.entryId)) return fail(400, 'Jurnal tidak valid');
    // Hapus permanen (baris ikut terhapus via ON DELETE CASCADE). Jurnal hasil
    // rekomendasi yang dihapus otomatis muncul lagi di daftar rekomendasi.
    const { error } = await admin.from('journal_entries').delete().eq('id', payload.entryId).eq('branch_id', branchId);
    if (error) return fail(500, 'Jurnal gagal dihapus');
    return { status: 200, data: { ok: true } };
  }

  if (payload.action === 'DISMISS_RECOMMENDATION') {
    const sourceId = String(payload.sourceId || '').trim();
    if (!sourceId) return fail(400, 'Rekomendasi tidak valid');
    // Cuplikan judul & nilai ikut disimpan supaya riwayat tetap terbaca walau
    // rekomendasinya tidak lagi dihasilkan ulang di kemudian hari.
    const { error } = await admin.from('journal_recommendation_dismissals').upsert({
      tenant_id: actor.tenantId,
      branch_id: branchId,
      source_id: sourceId,
      kind: String(payload.kind || 'LAINNYA'),
      title: String(payload.title || sourceId),
      amount: Math.max(0, Math.round(Number(payload.amount) || 0)),
      entry_date: typeof payload.date === 'string' && payload.date ? payload.date : null,
      dismissed_by: actor.actorId || null,
    }, { onConflict: 'branch_id,source_id' });
    if (error) return fail(500, 'Rekomendasi gagal diabaikan. Pastikan migrasi 202608300054 sudah dijalankan.');
    return { status: 200, data: { ok: true } };
  }

  if (payload.action === 'ARCHIVE_DISMISSAL') {
    const sourceId = String(payload.sourceId || '').trim();
    if (!sourceId) return fail(400, 'Rekomendasi tidak valid');
    // Hanya menyembunyikan dari daftar riwayat. Barisnya SENGAJA dipertahankan
    // supaya rekomendasinya tetap tertahan; menghapus barisnya justru akan
    // memunculkannya kembali di daftar rekomendasi.
    const { error } = await admin.from('journal_recommendation_dismissals')
      .update({ archived_at: new Date().toISOString() })
      .eq('branch_id', branchId).eq('source_id', sourceId);
    if (error) return fail(500, 'Riwayat gagal dihapus. Pastikan migrasi 202608300055 sudah dijalankan.');
    return { status: 200, data: { ok: true } };
  }

  if (payload.action === 'RESTORE_RECOMMENDATION') {
    const sourceId = String(payload.sourceId || '').trim();
    if (!sourceId) return fail(400, 'Rekomendasi tidak valid');
    // Menghapus jejak pengabaian; rekomendasinya akan dihasilkan lagi pada
    // pemuatan berikutnya selama data sumbernya masih ada.
    const { error } = await admin.from('journal_recommendation_dismissals')
      .delete().eq('branch_id', branchId).eq('source_id', sourceId);
    if (error) return fail(500, 'Rekomendasi gagal dipanggil kembali');
    return { status: 200, data: { ok: true } };
  }

  if (payload.action === 'SAVE_ACCOUNT') {
    const account = payload.account || {};
    const code = String(account.code || '').trim();
    const name = String(account.name || '').trim();
    const type = String(account.type || '').toUpperCase();
    if (!code || code.length > 20) return fail(400, 'Kode akun wajib (maks 20 karakter)');
    if (!name || name.length > 80) return fail(400, 'Nama akun wajib (maks 80 karakter)');
    if (!ACCOUNT_TYPES.has(type)) return fail(400, 'Tipe akun tidak valid');
    const normalBalance = account.normalBalance && (account.normalBalance === 'DEBIT' || account.normalBalance === 'CREDIT')
      ? account.normalBalance : naturalBalance(type);

    if (account.id && UUID_PATTERN.test(account.id)) {
      // Edit akun yang ada. Kode tidak diubah bila bentrok — cek duplikat kode lain.
      const { data: dup } = await admin.from('chart_of_accounts')
        .select('id').eq('branch_id', branchId).eq('code', code).neq('id', account.id).limit(1);
      if (dup && dup.length > 0) return fail(409, `Kode akun ${code} sudah dipakai akun lain`);
      const { error } = await admin.from('chart_of_accounts')
        .update({ code, name, type, normal_balance: normalBalance, updated_at: new Date().toISOString() })
        .eq('id', account.id).eq('branch_id', branchId);
      if (error) return fail(500, 'Akun gagal diperbarui');
      // Selaraskan account_code pada baris jurnal bila kode berubah.
      await admin.from('journal_lines').update({ account_code: code }).eq('account_id', account.id).eq('branch_id', branchId);
      return { status: 200, data: { ok: true } };
    }

    const { data: dup } = await admin.from('chart_of_accounts').select('id').eq('branch_id', branchId).eq('code', code).limit(1);
    if (dup && dup.length > 0) return fail(409, `Kode akun ${code} sudah ada`);
    const { error } = await admin.from('chart_of_accounts').insert({
      tenant_id: actor.tenantId, branch_id: branchId, code, name, type,
      normal_balance: normalBalance, is_system: false, sort_order: 999,
    });
    if (error) return fail(500, 'Akun gagal disimpan');
    return { status: 200, data: { ok: true } };
  }

  if (payload.action === 'DELETE_ACCOUNT') {
    if (!payload.accountId || !UUID_PATTERN.test(payload.accountId)) return fail(400, 'Akun tidak valid');
    const { data: account } = await admin.from('chart_of_accounts')
      .select('is_system').eq('id', payload.accountId).eq('branch_id', branchId).maybeSingle();
    if (!account) return fail(404, 'Akun tidak ditemukan');
    if (account.is_system) return fail(400, 'Akun inti sistem tidak boleh dihapus (dipakai posting otomatis)');
    const { count } = await admin.from('journal_lines')
      .select('id', { count: 'exact', head: true }).eq('account_id', payload.accountId).eq('branch_id', branchId);
    if ((count || 0) > 0) return fail(400, 'Akun sudah dipakai di jurnal — nonaktifkan atau kosongkan dulu, tidak bisa dihapus.');
    const { error } = await admin.from('chart_of_accounts').delete().eq('id', payload.accountId).eq('branch_id', branchId);
    if (error) return fail(500, 'Akun gagal dihapus');
    return { status: 200, data: { ok: true } };
  }

  return fail(400, 'Aksi tidak dikenali');
}
