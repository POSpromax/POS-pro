import { getSupabase } from '../lib/supabase';

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type NormalBalance = 'DEBIT' | 'CREDIT';

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  parentCode?: string;
  isActive: boolean;
  isSystem: boolean;
  sortOrder: number;
}

export interface JournalLine {
  id: string;
  accountCode: string;
  debit: number;
  credit: number;
  memo?: string;
}

export interface JournalEntry {
  id: string;
  entryDate: string;
  reference: string;
  description: string;
  source: string;
  sourceId?: string;
  status: 'POSTED' | 'VOID';
  createdAt: string;
  lines: JournalLine[];
}

export interface OpeningBalance {
  accountCode: string;
  debit: number;
  credit: number;
}

export interface AccountingData {
  canManage: boolean;
  period: string;
  coa: Account[];
  entries: JournalEntry[];
  openingBalances: OpeningBalance[];
}

// ── HTTP ──────────────────────────────────────────────────────────────────────

async function requestAccounting(method: string, body: Record<string, unknown>): Promise<any> {
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sesi telah berakhir');
  const query = method === 'GET' ? `?${new URLSearchParams(body as Record<string, string>).toString()}` : '';
  const response = await fetch(`/api/accounting${query}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(method === 'GET' ? {} : { 'Content-Type': 'application/json' }),
    },
    body: method === 'GET' ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Operasi akuntansi gagal');
  return payload;
}

export const loadAccounting = (branchId: string, period: string): Promise<AccountingData> =>
  requestAccounting('GET', { branchId, period });

export interface JournalRecommendation {
  id: string;
  kind: 'SALES' | 'EXPENSE' | 'INCOME' | 'PAYROLL';
  source: string;
  sourceId: string;
  date: string;
  title: string;
  amount: number;
  lines: Array<{ code: string; debit: number; credit: number }>;
}

export const loadRecommendations = (branchId: string, period: string): Promise<{ period: string; recommendations: JournalRecommendation[] }> =>
  requestAccounting('GET', { branchId, period, view: 'recommendations' });

export const seedChartOfAccounts = (branchId: string): Promise<{ ok: boolean }> =>
  requestAccounting('POST', { branchId, action: 'SEED_COA' });

export const createJournalEntry = (payload: {
  branchId: string;
  entryDate: string;
  description: string;
  reference?: string;
  source?: string;
  sourceId?: string;
  lines: Array<{ code: string; debit: number; credit: number; memo?: string }>;
}): Promise<{ ok: boolean; entryId: string }> =>
  requestAccounting('POST', { ...payload, action: 'CREATE_ENTRY' });

export const voidJournalEntry = (branchId: string, entryId: string): Promise<{ ok: boolean }> =>
  requestAccounting('POST', { branchId, entryId, action: 'VOID_ENTRY' });

// ── Perhitungan (murni, dari data yang sudah diambil) ─────────────────────────

export interface AccountBalance {
  account: Account;
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
  asOfDebit: number;
  asOfCredit: number;
  // Saldo bersih searah saldo normal akun (selalu >= 0 pada kondisi wajar).
  asOfNet: number;
  periodNet: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Menggabungkan COA + saldo awal + mutasi periode menjadi saldo per akun.
 * Baris jurnal berstatus VOID diabaikan.
 */
export function computeBalances(data: AccountingData): AccountBalance[] {
  const opening = new Map<string, { debit: number; credit: number }>();
  data.openingBalances.forEach((row) => opening.set(row.accountCode, { debit: row.debit, credit: row.credit }));

  const period = new Map<string, { debit: number; credit: number }>();
  data.entries.forEach((entry) => {
    if (entry.status === 'VOID') return;
    entry.lines.forEach((line) => {
      const bucket = period.get(line.accountCode) || { debit: 0, credit: 0 };
      bucket.debit += line.debit;
      bucket.credit += line.credit;
      period.set(line.accountCode, bucket);
    });
  });

  return data.coa.map((account) => {
    const o = opening.get(account.code) || { debit: 0, credit: 0 };
    const p = period.get(account.code) || { debit: 0, credit: 0 };
    const asOfDebit = round2(o.debit + p.debit);
    const asOfCredit = round2(o.credit + p.credit);
    const netDebit = asOfDebit - asOfCredit;
    const periodNetDebit = p.debit - p.credit;
    // Searah arah NATURAL TIPE akun (bukan saldo normal akun), supaya akun kontra
    // seperti Prive (tipe EQUITY tapi saldo normal debit) benar-benar MENGURANGI
    // total modal di neraca. Aset/Beban = debit-natural; Kewajiban/Modal/Pendapatan
    // = kredit-natural.
    const debitNatural = account.type === 'ASSET' || account.type === 'EXPENSE';
    const sign = debitNatural ? 1 : -1;
    return {
      account,
      openingDebit: o.debit,
      openingCredit: o.credit,
      periodDebit: p.debit,
      periodCredit: p.credit,
      asOfDebit,
      asOfCredit,
      asOfNet: round2(sign * netDebit),
      periodNet: round2(sign * periodNetDebit),
    };
  });
}

export interface IncomeStatement {
  revenues: AccountBalance[];
  expenses: AccountBalance[];
  totalRevenue: number;
  totalExpense: number;
  netIncome: number;
}

/** Laba-Rugi periode berjalan (memakai mutasi periode, bukan kumulatif). */
export function buildIncomeStatement(balances: AccountBalance[]): IncomeStatement {
  const revenues = balances.filter((b) => b.account.type === 'REVENUE' && (b.periodDebit !== 0 || b.periodCredit !== 0));
  const expenses = balances.filter((b) => b.account.type === 'EXPENSE' && (b.periodDebit !== 0 || b.periodCredit !== 0));
  const totalRevenue = round2(revenues.reduce((sum, b) => sum + b.periodNet, 0));
  const totalExpense = round2(expenses.reduce((sum, b) => sum + b.periodNet, 0));
  return { revenues, expenses, totalRevenue, totalExpense, netIncome: round2(totalRevenue - totalExpense) };
}

export interface BalanceSheet {
  assets: AccountBalance[];
  liabilities: AccountBalance[];
  equity: AccountBalance[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquityBase: number;   // modal + laba ditahan - prive (tanpa laba berjalan)
  cumulativeNetIncome: number; // laba berjalan kumulatif s/d akhir periode
  totalEquity: number;       // totalEquityBase + cumulativeNetIncome
  isBalanced: boolean;
}

/** Neraca per akhir periode (memakai saldo kumulatif as-of). */
export function buildBalanceSheet(balances: AccountBalance[]): BalanceSheet {
  const assets = balances.filter((b) => b.account.type === 'ASSET' && b.asOfNet !== 0);
  const liabilities = balances.filter((b) => b.account.type === 'LIABILITY' && b.asOfNet !== 0);
  const equity = balances.filter((b) => b.account.type === 'EQUITY' && b.asOfNet !== 0);

  const totalAssets = round2(assets.reduce((sum, b) => sum + b.asOfNet, 0));
  const totalLiabilities = round2(liabilities.reduce((sum, b) => sum + b.asOfNet, 0));
  const totalEquityBase = round2(equity.reduce((sum, b) => sum + b.asOfNet, 0));

  // Laba berjalan kumulatif = pendapatan - beban (as-of, belum ditutup ke laba ditahan).
  const cumulativeRevenue = round2(balances.filter((b) => b.account.type === 'REVENUE').reduce((sum, b) => sum + b.asOfNet, 0));
  const cumulativeExpense = round2(balances.filter((b) => b.account.type === 'EXPENSE').reduce((sum, b) => sum + b.asOfNet, 0));
  const cumulativeNetIncome = round2(cumulativeRevenue - cumulativeExpense);

  const totalEquity = round2(totalEquityBase + cumulativeNetIncome);
  return {
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquityBase,
    cumulativeNetIncome,
    totalEquity,
    isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
  };
}

export interface TrialBalanceRow {
  account: Account;
  debit: number;   // ditempatkan pada kolom debit bila saldo bersih debit
  credit: number;  // atau kolom kredit bila saldo bersih kredit
}

/** Neraca Saldo (as-of): setiap akun ditempatkan pada kolom sesuai saldo bersih. */
export function buildTrialBalance(balances: AccountBalance[]): {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
} {
  const rows: TrialBalanceRow[] = [];
  let totalDebit = 0;
  let totalCredit = 0;
  balances.forEach((b) => {
    const netDebit = round2(b.asOfDebit - b.asOfCredit);
    if (netDebit === 0) return;
    if (netDebit > 0) {
      rows.push({ account: b.account, debit: netDebit, credit: 0 });
      totalDebit = round2(totalDebit + netDebit);
    } else {
      rows.push({ account: b.account, debit: 0, credit: -netDebit });
      totalCredit = round2(totalCredit - netDebit);
    }
  });
  return { rows, totalDebit, totalCredit, isBalanced: Math.abs(totalDebit - totalCredit) < 0.01 };
}
