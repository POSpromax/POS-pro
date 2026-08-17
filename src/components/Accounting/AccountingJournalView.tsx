import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen, Plus, Trash2, Scale, TrendingUp, Wallet, Layers, Loader2,
  CheckCircle2, AlertTriangle, RotateCcw, FileText,
} from 'lucide-react';
import {
  loadAccounting, seedChartOfAccounts, createJournalEntry, voidJournalEntry,
  computeBalances, buildIncomeStatement, buildBalanceSheet, buildTrialBalance,
  type AccountingData, type Account,
} from '../../services/accountingService';

interface Props {
  currentBranch: { id: string; name: string };
  activeUser: { role: string; name?: string };
  onShowToast?: (title: string, message: string) => void;
}

type Tab = 'JOURNAL' | 'LEDGER' | 'TRIAL' | 'INCOME' | 'BALANCE' | 'COA';

interface DraftLine {
  code: string;
  debit: number;
  credit: number;
  memo: string;
}

const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;
const todayKey = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => new Date().toISOString().slice(0, 7);
const emptyLine = (): DraftLine => ({ code: '', debit: 0, credit: 0, memo: '' });

const TYPE_LABEL: Record<Account['type'], string> = {
  ASSET: 'Aset',
  LIABILITY: 'Kewajiban',
  EQUITY: 'Modal',
  REVENUE: 'Pendapatan',
  EXPENSE: 'Beban',
};

export function AccountingJournalView({ currentBranch, activeUser, onShowToast }: Props) {
  const canManage = ['SUPER_OWNER', 'OWNER', 'MANAGER', 'ADMIN'].includes(activeUser.role);
  const [tab, setTab] = useState<Tab>('JOURNAL');
  const [period, setPeriod] = useState(currentMonth());
  const [data, setData] = useState<AccountingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [seeding, setSeeding] = useState(false);

  // Form jurnal baru
  const [showForm, setShowForm] = useState(false);
  const [entryDate, setEntryDate] = useState(todayKey());
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([emptyLine(), emptyLine()]);
  const [saving, setSaving] = useState(false);

  const [ledgerCode, setLedgerCode] = useState('');

  const refresh = async () => {
    if (!currentBranch.id) return;
    setLoading(true);
    setError('');
    try {
      const result = await loadAccounting(currentBranch.id, period);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Data akuntansi gagal dimuat');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBranch.id, period]);

  const activeAccounts = useMemo(
    () => (data?.coa || []).filter((a) => a.isActive).sort((a, b) => a.code.localeCompare(b.code)),
    [data],
  );
  const balances = useMemo(() => (data ? computeBalances(data) : []), [data]);
  const income = useMemo(() => buildIncomeStatement(balances), [balances]);
  const sheet = useMemo(() => buildBalanceSheet(balances), [balances]);
  const trial = useMemo(() => buildTrialBalance(balances), [balances]);

  const totalDebit = lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
  const balanced = Math.round(totalDebit * 100) === Math.round(totalCredit * 100) && totalDebit > 0;

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedChartOfAccounts(currentBranch.id);
      onShowToast?.('Bagan Akun Siap', 'Bagan akun standar UMKM F&B berhasil dibuat untuk outlet ini.');
      await refresh();
    } catch (err) {
      onShowToast?.('Gagal', err instanceof Error ? err.message : 'Bagan akun gagal disiapkan.');
    } finally {
      setSeeding(false);
    }
  };

  const setLine = (index: number, patch: Partial<DraftLine>) => {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const submitEntry = async () => {
    const cleaned = lines
      .map((l) => ({ code: l.code, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, memo: l.memo.trim() || undefined }))
      .filter((l) => l.code && (l.debit > 0 || l.credit > 0));
    if (cleaned.length < 2) {
      onShowToast?.('Jurnal Belum Lengkap', 'Isi minimal 2 baris dengan akun dan nominal.');
      return;
    }
    if (!balanced) {
      onShowToast?.('Tidak Seimbang', 'Total debit harus sama dengan total kredit.');
      return;
    }
    setSaving(true);
    try {
      await createJournalEntry({ branchId: currentBranch.id, entryDate, description, reference: reference || undefined, lines: cleaned });
      onShowToast?.('Jurnal Tersimpan', 'Ayat jurnal berhasil dicatat.');
      setDescription('');
      setReference('');
      setLines([emptyLine(), emptyLine()]);
      setShowForm(false);
      await refresh();
    } catch (err) {
      onShowToast?.('Gagal', err instanceof Error ? err.message : 'Jurnal gagal disimpan.');
    } finally {
      setSaving(false);
    }
  };

  const handleVoid = async (entryId: string) => {
    try {
      await voidJournalEntry(currentBranch.id, entryId);
      onShowToast?.('Jurnal Dibatalkan', 'Ayat jurnal ditandai batal (void).');
      await refresh();
    } catch (err) {
      onShowToast?.('Gagal', err instanceof Error ? err.message : 'Jurnal gagal dibatalkan.');
    }
  };

  if (!canManage) {
    return (
      <div className="ui-surface flex-1 flex items-center justify-center p-8">
        <p className="text-sm font-bold text-[var(--text-tertiary)]">Hanya manajemen yang dapat mengakses akuntansi.</p>
      </div>
    );
  }

  const needsSeed = !loading && !error && data != null && data.coa.length === 0;

  const tabs: Array<{ id: Tab; label: string; icon: typeof BookOpen }> = [
    { id: 'JOURNAL', label: 'Jurnal Umum', icon: BookOpen },
    { id: 'LEDGER', label: 'Buku Besar', icon: FileText },
    { id: 'TRIAL', label: 'Neraca Saldo', icon: Scale },
    { id: 'INCOME', label: 'Laba Rugi', icon: TrendingUp },
    { id: 'BALANCE', label: 'Neraca', icon: Wallet },
    { id: 'COA', label: 'Bagan Akun', icon: Layers },
  ];

  return (
    <div className="ui-surface flex-1 overflow-y-auto font-sans" style={{ padding: '20px 20px 40px' }}>
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="ui-stat-label mb-1">Akuntansi · {currentBranch.name}</p>
          <h1 className="text-xl font-black text-[var(--text-primary)]">Jurnal & Pembukuan</h1>
          <p className="mt-1 text-[12px] font-semibold text-[var(--text-secondary)]">
            Pencatatan double-entry: setiap transaksi seimbang debit = kredit.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-bold uppercase text-[var(--text-tertiary)]">Periode</label>
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="ui-input max-w-[170px] font-mono"
          />
          <button type="button" onClick={() => void refresh()} className="ui-button ui-button-secondary min-h-9 px-3" title="Muat ulang">
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="ui-tabs mb-5 flex flex-wrap gap-1 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`ui-tab flex items-center gap-1.5 whitespace-nowrap ${tab === t.id ? 'ui-tab-active' : ''}`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-20 text-sm font-bold text-[var(--text-tertiary)]">
          <Loader2 className="h-5 w-5 animate-spin" /> Memuat data akuntansi…
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-[var(--accent-red)]/30 bg-[var(--danger-soft)] p-6 text-center">
          <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-[var(--accent-red)]" />
          <p className="text-sm font-bold text-[var(--accent-red)]">{error}</p>
        </div>
      )}

      {needsSeed && (
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-card)] p-8 text-center">
          <Layers className="mx-auto mb-3 h-8 w-8 text-[var(--primary-hover)]" />
          <h3 className="text-base font-bold text-[var(--text-primary)]">Bagan Akun belum disiapkan</h3>
          <p className="mx-auto mt-1 max-w-md text-[12px] font-semibold text-[var(--text-secondary)]">
            Siapkan bagan akun (Chart of Accounts) standar UMKM F&B untuk outlet ini — Kas, Bank/QRIS,
            Persediaan, Pendapatan Penjualan, HPP, Beban Gaji, dan lainnya. Bisa disesuaikan nanti.
          </p>
          <button type="button" disabled={seeding} onClick={() => void handleSeed()} className="ui-button ui-button-primary mx-auto mt-4">
            {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Siapkan Bagan Akun Standar
          </button>
        </div>
      )}

      {!loading && !error && data && data.coa.length > 0 && (
        <>
          {tab === 'JOURNAL' && (
            <JournalTab
              data={data}
              showForm={showForm}
              setShowForm={setShowForm}
              entryDate={entryDate}
              setEntryDate={setEntryDate}
              description={description}
              setDescription={setDescription}
              reference={reference}
              setReference={setReference}
              lines={lines}
              setLine={setLine}
              addLine={() => setLines((c) => [...c, emptyLine()])}
              removeLine={(i) => setLines((c) => (c.length > 2 ? c.filter((_, idx) => idx !== i) : c))}
              accounts={activeAccounts}
              totalDebit={totalDebit}
              totalCredit={totalCredit}
              balanced={balanced}
              saving={saving}
              onSubmit={() => void submitEntry()}
              onVoid={(id) => void handleVoid(id)}
            />
          )}
          {tab === 'LEDGER' && (
            <LedgerTab data={data} accounts={activeAccounts} ledgerCode={ledgerCode} setLedgerCode={setLedgerCode} />
          )}
          {tab === 'TRIAL' && <TrialTab trial={trial} />}
          {tab === 'INCOME' && <IncomeTab income={income} period={period} />}
          {tab === 'BALANCE' && <BalanceTab sheet={sheet} />}
          {tab === 'COA' && <CoaTab accounts={data.coa} />}
        </>
      )}
    </div>
  );
}

// ── Jurnal Umum ────────────────────────────────────────────────────────────────

function JournalTab(props: {
  data: AccountingData;
  showForm: boolean; setShowForm: (v: boolean) => void;
  entryDate: string; setEntryDate: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  reference: string; setReference: (v: string) => void;
  lines: DraftLine[]; setLine: (i: number, patch: Partial<DraftLine>) => void;
  addLine: () => void; removeLine: (i: number) => void;
  accounts: Account[];
  totalDebit: number; totalCredit: number; balanced: boolean;
  saving: boolean; onSubmit: () => void; onVoid: (id: string) => void;
}) {
  const { data, accounts } = props;
  const accountName = (code: string) => accounts.find((a) => a.code === code)?.name || code;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">Ayat Jurnal Periode Ini <span className="text-[var(--text-tertiary)]">({data.entries.length})</span></h3>
        <button type="button" onClick={() => props.setShowForm(!props.showForm)} className="ui-button ui-button-primary min-h-9 px-3.5 text-[12px]">
          <Plus className="h-4 w-4" /> {props.showForm ? 'Tutup Form' : 'Buat Jurnal'}
        </button>
      </div>

      {props.showForm && (
        <div className="ui-card p-5 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase text-[var(--text-tertiary)]">Tanggal</label>
              <input type="date" value={props.entryDate} onChange={(e) => props.setEntryDate(e.target.value)} className="ui-input w-full font-mono" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[11px] font-bold uppercase text-[var(--text-tertiary)]">Keterangan</label>
              <input type="text" value={props.description} onChange={(e) => props.setDescription(e.target.value)} placeholder="mis. Bayar sewa outlet Agustus" className="ui-input w-full" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="hidden grid-cols-12 gap-2 px-1 text-[10px] font-black uppercase tracking-wider text-[var(--text-tertiary)] sm:grid">
              <span className="col-span-5">Akun</span>
              <span className="col-span-3 text-right">Debit</span>
              <span className="col-span-3 text-right">Kredit</span>
              <span className="col-span-1" />
            </div>
            {props.lines.map((line, i) => (
              <div key={i} className="grid grid-cols-12 items-center gap-2">
                <select
                  value={line.code}
                  onChange={(e) => props.setLine(i, { code: e.target.value })}
                  className="ui-input col-span-12 sm:col-span-5 text-[12px]"
                >
                  <option value="">— pilih akun —</option>
                  {accounts.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}
                </select>
                <input
                  type="number" min={0} inputMode="numeric"
                  value={line.debit || ''}
                  onChange={(e) => props.setLine(i, { debit: Number(e.target.value) || 0, credit: 0 })}
                  placeholder="0"
                  className="ui-input col-span-5 sm:col-span-3 text-right font-mono text-[12px]"
                />
                <input
                  type="number" min={0} inputMode="numeric"
                  value={line.credit || ''}
                  onChange={(e) => props.setLine(i, { credit: Number(e.target.value) || 0, debit: 0 })}
                  placeholder="0"
                  className="ui-input col-span-5 sm:col-span-3 text-right font-mono text-[12px]"
                />
                <button type="button" onClick={() => props.removeLine(i)} className="col-span-2 sm:col-span-1 flex justify-center text-[var(--text-tertiary)] hover:text-[var(--accent-red)]" title="Hapus baris">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button type="button" onClick={props.addLine} className="text-[12px] font-bold text-[var(--primary-hover)] hover:underline">+ Tambah baris</button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--panel-border-light)] pt-3">
            <div className="flex items-center gap-4 text-[12px] font-bold">
              <span className="text-[var(--text-secondary)]">Total Debit: <span className="font-mono text-[var(--text-primary)]">{rp(props.totalDebit)}</span></span>
              <span className="text-[var(--text-secondary)]">Total Kredit: <span className="font-mono text-[var(--text-primary)]">{rp(props.totalCredit)}</span></span>
              {props.balanced
                ? <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--primary-soft)] px-2 py-1 text-[11px] text-[var(--primary-text)]"><CheckCircle2 className="h-3.5 w-3.5" /> Seimbang</span>
                : <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--danger-soft)] px-2 py-1 text-[11px] text-[var(--accent-red)]"><AlertTriangle className="h-3.5 w-3.5" /> Selisih {rp(Math.abs(props.totalDebit - props.totalCredit))}</span>}
            </div>
            <button type="button" disabled={!props.balanced || props.saving} onClick={props.onSubmit} className="ui-button ui-button-primary min-h-9 px-4">
              {props.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Simpan Jurnal
            </button>
          </div>
        </div>
      )}

      {data.entries.length === 0 ? (
        <p className="rounded-2xl bg-[var(--surface-secondary)] p-10 text-center text-xs font-bold text-[var(--text-tertiary)]">Belum ada jurnal pada periode ini.</p>
      ) : (
        <div className="space-y-3">
          {data.entries.map((entry) => {
            const total = entry.lines.reduce((s, l) => s + l.debit, 0);
            const isVoid = entry.status === 'VOID';
            return (
              <div key={entry.id} className={`ui-card p-4 ${isVoid ? 'opacity-55' : ''}`}>
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-bold text-[var(--text-primary)]">
                      {new Date(entry.entryDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {entry.reference && <span className="ml-2 rounded bg-[var(--surface-secondary)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-secondary)]">{entry.reference}</span>}
                      {isVoid && <span className="ml-2 rounded bg-[var(--danger-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent-red)]">VOID</span>}
                    </p>
                    <p className="text-[12px] font-semibold text-[var(--text-secondary)]">{entry.description || '—'}
                      {entry.source !== 'MANUAL' && <span className="ml-1.5 text-[10px] font-bold uppercase text-[var(--text-tertiary)]">· {entry.source}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[13px] font-bold text-[var(--text-primary)]">{rp(total)}</span>
                    {!isVoid && entry.source === 'MANUAL' && (
                      <button type="button" onClick={() => props.onVoid(entry.id)} className="text-[var(--text-tertiary)] hover:text-[var(--accent-red)]" title="Batalkan jurnal">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  {entry.lines.map((line) => (
                    <div key={line.id} className="grid grid-cols-12 gap-2 text-[12px]">
                      <span className={`col-span-6 ${line.credit > 0 ? 'pl-4' : ''} font-semibold text-[var(--text-primary)]`}>
                        {line.accountCode} · {accountName(line.accountCode)}
                        {line.memo && <span className="ml-1 text-[10px] font-normal text-[var(--text-tertiary)]">({line.memo})</span>}
                      </span>
                      <span className="col-span-3 text-right font-mono text-[var(--text-secondary)]">{line.debit > 0 ? rp(line.debit) : ''}</span>
                      <span className="col-span-3 text-right font-mono text-[var(--text-secondary)]">{line.credit > 0 ? rp(line.credit) : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Buku Besar ─────────────────────────────────────────────────────────────────

function LedgerTab({ data, accounts, ledgerCode, setLedgerCode }: {
  data: AccountingData; accounts: Account[]; ledgerCode: string; setLedgerCode: (v: string) => void;
}) {
  const account = accounts.find((a) => a.code === ledgerCode);
  const opening = data.openingBalances.find((o) => o.accountCode === ledgerCode);
  const sign = account?.normalBalance === 'CREDIT' ? -1 : 1;
  const openingNet = opening ? sign * (opening.debit - opening.credit) : 0;

  const rows = useMemo(() => {
    if (!account) return [];
    const entryRows = data.entries
      .filter((e) => e.status !== 'VOID')
      .flatMap((e) => e.lines.filter((l) => l.accountCode === ledgerCode).map((l) => ({ date: e.entryDate, description: e.description, debit: l.debit, credit: l.credit })))
      .sort((a, b) => a.date.localeCompare(b.date));
    let running = openingNet;
    return entryRows.map((r) => {
      running += sign * (r.debit - r.credit);
      return { ...r, running };
    });
  }, [account, data.entries, ledgerCode, openingNet, sign]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[11px] font-bold uppercase text-[var(--text-tertiary)]">Akun</label>
        <select value={ledgerCode} onChange={(e) => setLedgerCode(e.target.value)} className="ui-input max-w-md">
          <option value="">— pilih akun untuk lihat buku besar —</option>
          {accounts.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}
        </select>
      </div>

      {!account ? (
        <p className="rounded-2xl bg-[var(--surface-secondary)] p-10 text-center text-xs font-bold text-[var(--text-tertiary)]">Pilih akun untuk menampilkan mutasi & saldo berjalan.</p>
      ) : (
        <div className="ui-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--panel-border)] p-4">
            <div>
              <p className="text-sm font-bold text-[var(--text-primary)]">{account.code} · {account.name}</p>
              <p className="text-[11px] font-semibold text-[var(--text-tertiary)]">{TYPE_LABEL[account.type]} · Saldo normal {account.normalBalance === 'DEBIT' ? 'Debit' : 'Kredit'}</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
              <thead>
                <tr className="border-b border-[var(--panel-border-light)] text-[10px] font-black uppercase tracking-wider text-[var(--text-tertiary)]">
                  <th className="p-3 text-left">Tanggal</th>
                  <th className="p-3 text-left">Keterangan</th>
                  <th className="p-3 text-right">Debit</th>
                  <th className="p-3 text-right">Kredit</th>
                  <th className="p-3 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[var(--panel-border-light)] bg-[var(--surface-secondary)]/50">
                  <td className="p-3 font-semibold text-[var(--text-tertiary)]" colSpan={4}>Saldo awal periode</td>
                  <td className="p-3 text-right font-mono font-bold text-[var(--text-primary)]">{rp(openingNet)}</td>
                </tr>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-[var(--panel-border-light)] last:border-0">
                    <td className="p-3 font-mono text-[var(--text-secondary)]">{new Date(r.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</td>
                    <td className="p-3 text-[var(--text-primary)]">{r.description || '—'}</td>
                    <td className="p-3 text-right font-mono text-[var(--text-secondary)]">{r.debit > 0 ? rp(r.debit) : ''}</td>
                    <td className="p-3 text-right font-mono text-[var(--text-secondary)]">{r.credit > 0 ? rp(r.credit) : ''}</td>
                    <td className="p-3 text-right font-mono font-bold text-[var(--text-primary)]">{rp(r.running)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center text-[var(--text-tertiary)]">Tidak ada mutasi pada periode ini.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Neraca Saldo ───────────────────────────────────────────────────────────────

function TrialTab({ trial }: { trial: ReturnType<typeof buildTrialBalance> }) {
  return (
    <div className="ui-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--panel-border)] p-4">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">Neraca Saldo (per akhir periode)</h3>
        {trial.isBalanced
          ? <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--primary-soft)] px-2 py-1 text-[11px] font-bold text-[var(--primary-text)]"><CheckCircle2 className="h-3.5 w-3.5" /> Seimbang</span>
          : <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--danger-soft)] px-2 py-1 text-[11px] font-bold text-[var(--accent-red)]"><AlertTriangle className="h-3.5 w-3.5" /> Tidak seimbang</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr className="border-b border-[var(--panel-border-light)] text-[10px] font-black uppercase tracking-wider text-[var(--text-tertiary)]">
              <th className="p-3 text-left">Kode</th>
              <th className="p-3 text-left">Nama Akun</th>
              <th className="p-3 text-right">Debit</th>
              <th className="p-3 text-right">Kredit</th>
            </tr>
          </thead>
          <tbody>
            {trial.rows.map((row) => (
              <tr key={row.account.code} className="border-b border-[var(--panel-border-light)] last:border-0">
                <td className="p-3 font-mono text-[var(--text-secondary)]">{row.account.code}</td>
                <td className="p-3 font-semibold text-[var(--text-primary)]">{row.account.name}</td>
                <td className="p-3 text-right font-mono text-[var(--text-primary)]">{row.debit > 0 ? rp(row.debit) : ''}</td>
                <td className="p-3 text-right font-mono text-[var(--text-primary)]">{row.credit > 0 ? rp(row.credit) : ''}</td>
              </tr>
            ))}
            {trial.rows.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-[var(--text-tertiary)]">Belum ada saldo.</td></tr>}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[var(--panel-border-strong)] font-bold">
              <td className="p-3" colSpan={2}>TOTAL</td>
              <td className="p-3 text-right font-mono text-[var(--text-primary)]">{rp(trial.totalDebit)}</td>
              <td className="p-3 text-right font-mono text-[var(--text-primary)]">{rp(trial.totalCredit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── Laba Rugi ──────────────────────────────────────────────────────────────────

function IncomeTab({ income, period }: { income: ReturnType<typeof buildIncomeStatement>; period: string }) {
  const Section = ({ title, rows }: { title: string; rows: typeof income.revenues }) => (
    <div>
      <p className="mb-1 text-[11px] font-black uppercase tracking-wider text-[var(--text-tertiary)]">{title}</p>
      {rows.length === 0 ? <p className="py-2 text-[12px] text-[var(--text-tertiary)]">—</p> : rows.map((r) => (
        <div key={r.account.code} className="flex justify-between py-1 text-[13px]">
          <span className="text-[var(--text-primary)]">{r.account.name}</span>
          <span className="font-mono font-semibold text-[var(--text-primary)]">{rp(r.periodNet)}</span>
        </div>
      ))}
    </div>
  );
  return (
    <div className="ui-card mx-auto max-w-2xl p-6" style={{ fontVariantNumeric: 'tabular-nums' }}>
      <h3 className="text-center text-sm font-black uppercase tracking-wide text-[var(--text-primary)]">Laporan Laba Rugi</h3>
      <p className="mb-5 text-center text-[11px] font-semibold text-[var(--text-tertiary)]">Periode {new Date(period + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</p>
      <div className="space-y-4">
        <Section title="Pendapatan" rows={income.revenues} />
        <div className="flex justify-between border-t border-[var(--panel-border-light)] py-2 text-[13px] font-bold">
          <span>Total Pendapatan</span><span className="font-mono text-[var(--primary-hover)]">{rp(income.totalRevenue)}</span>
        </div>
        <Section title="Beban" rows={income.expenses} />
        <div className="flex justify-between border-t border-[var(--panel-border-light)] py-2 text-[13px] font-bold">
          <span>Total Beban</span><span className="font-mono text-[var(--accent-red)]">({rp(income.totalExpense)})</span>
        </div>
        <div className={`flex justify-between rounded-xl px-4 py-3 text-sm font-black ${income.netIncome >= 0 ? 'bg-[var(--primary-soft)] text-[var(--primary-text)]' : 'bg-[var(--danger-soft)] text-[var(--accent-red)]'}`}>
          <span>{income.netIncome >= 0 ? 'LABA BERSIH' : 'RUGI BERSIH'}</span>
          <span className="font-mono">{rp(income.netIncome)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Neraca ─────────────────────────────────────────────────────────────────────

function BalanceTab({ sheet }: { sheet: ReturnType<typeof buildBalanceSheet> }) {
  const Row = ({ label, value, indent }: { label: string; value: number; indent?: boolean }) => (
    <div className={`flex justify-between py-1 text-[13px] ${indent ? 'pl-2' : ''}`}>
      <span className="text-[var(--text-primary)]">{label}</span>
      <span className="font-mono font-semibold text-[var(--text-primary)]">{rp(value)}</span>
    </div>
  );
  return (
    <div className="ui-card mx-auto max-w-3xl p-6" style={{ fontVariantNumeric: 'tabular-nums' }}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-wide text-[var(--text-primary)]">Neraca</h3>
        {sheet.isBalanced
          ? <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--primary-soft)] px-2 py-1 text-[11px] font-bold text-[var(--primary-text)]"><CheckCircle2 className="h-3.5 w-3.5" /> Seimbang</span>
          : <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--danger-soft)] px-2 py-1 text-[11px] font-bold text-[var(--accent-red)]"><AlertTriangle className="h-3.5 w-3.5" /> Selisih {rp(Math.abs(sheet.totalAssets - (sheet.totalLiabilities + sheet.totalEquity)))}</span>}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <p className="mb-1 text-[11px] font-black uppercase tracking-wider text-[var(--text-tertiary)]">Aset</p>
          {sheet.assets.map((a) => <Row key={a.account.code} label={a.account.name} value={a.asOfNet} indent />)}
          <div className="mt-2 flex justify-between border-t-2 border-[var(--panel-border-strong)] pt-2 text-[13px] font-black">
            <span>TOTAL ASET</span><span className="font-mono">{rp(sheet.totalAssets)}</span>
          </div>
        </div>
        <div>
          <p className="mb-1 text-[11px] font-black uppercase tracking-wider text-[var(--text-tertiary)]">Kewajiban</p>
          {sheet.liabilities.length === 0 ? <p className="py-1 text-[12px] text-[var(--text-tertiary)]">—</p> : sheet.liabilities.map((a) => <Row key={a.account.code} label={a.account.name} value={a.asOfNet} indent />)}
          <div className="mt-1 flex justify-between border-t border-[var(--panel-border-light)] py-1 text-[13px] font-bold">
            <span>Total Kewajiban</span><span className="font-mono">{rp(sheet.totalLiabilities)}</span>
          </div>
          <p className="mb-1 mt-4 text-[11px] font-black uppercase tracking-wider text-[var(--text-tertiary)]">Modal</p>
          {sheet.equity.map((a) => <Row key={a.account.code} label={a.account.name} value={a.asOfNet} indent />)}
          <Row label="Laba (Rugi) Berjalan" value={sheet.cumulativeNetIncome} indent />
          <div className="mt-1 flex justify-between border-t border-[var(--panel-border-light)] py-1 text-[13px] font-bold">
            <span>Total Modal</span><span className="font-mono">{rp(sheet.totalEquity)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t-2 border-[var(--panel-border-strong)] pt-2 text-[13px] font-black">
            <span>TOTAL KEWAJIBAN + MODAL</span><span className="font-mono">{rp(sheet.totalLiabilities + sheet.totalEquity)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Bagan Akun ─────────────────────────────────────────────────────────────────

function CoaTab({ accounts }: { accounts: Account[] }) {
  const groups: Account['type'][] = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {groups.map((type) => {
        const rows = accounts.filter((a) => a.type === type).sort((a, b) => a.code.localeCompare(b.code));
        if (rows.length === 0) return null;
        return (
          <div key={type} className="ui-card p-4">
            <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-[var(--primary-hover)]">{TYPE_LABEL[type]}</p>
            <div className="space-y-1">
              {rows.map((a) => (
                <div key={a.code} className="flex items-center justify-between text-[12px]">
                  <span className="text-[var(--text-primary)]"><span className="font-mono text-[var(--text-tertiary)]">{a.code}</span> · {a.name}</span>
                  {a.isSystem && <span className="rounded bg-[var(--surface-secondary)] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[var(--text-tertiary)]">inti</span>}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
