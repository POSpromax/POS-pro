import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, ArrowDownCircle, ArrowUpCircle, ClipboardCheck, Loader2, X, History, PackageSearch,
} from 'lucide-react';
import type { RawMaterial } from '../../types/pos';
import {
  adjustStockManual, listStockMovements, STOCK_MOVEMENT_LABELS,
  type StockMovement, type StockMovementType,
} from '../../services/stockLedgerService';

type Mode = 'IN' | 'OUT' | 'OPNAME';

const MODE_META: Record<Mode, { label: string; type: StockMovementType; tone: string; hint: string }> = {
  IN: { label: 'Stok Masuk', type: 'PURCHASE', tone: 'text-emerald-700', hint: 'Belanja / barang datang — stok bertambah.' },
  OUT: { label: 'Stok Keluar', type: 'WASTE', tone: 'text-rose-700', hint: 'Rusak / terbuang / dipakai — stok berkurang.' },
  OPNAME: { label: 'Opname Fisik', type: 'OPNAME', tone: 'text-sky-700', hint: 'Hitung fisik nyata — sistem disesuaikan ke angka ini.' },
};

interface Props {
  rawMaterials: RawMaterial[];
  branchId?: string;
  onRefresh: () => Promise<void> | void;
  onShowToast: (title: string, message: string) => void;
}

const fmt = (n: number) => Number(n || 0).toLocaleString('id-ID');

export const StockOpnamePanel: React.FC<Props> = ({ rawMaterials, branchId, onRefresh, onShowToast }) => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<RawMaterial | null>(null);
  const [mode, setMode] = useState<Mode>('OPNAME');
  const [amount, setAmount] = useState<number | ''>('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [movements, setMovements] = useState<StockMovement[]>([]);

  const loadMovements = async () => {
    if (!branchId) return;
    try {
      const result = await listStockMovements({ branchId, limit: 25 });
      setMovements(result.rows.filter((row) => ['PURCHASE', 'WASTE', 'ADJUSTMENT', 'OPNAME'].includes(row.type)));
    } catch { /* riwayat opsional — abaikan bila gagal */ }
  };
  useEffect(() => { void loadMovements(); /* eslint-disable-next-line */ }, [branchId]);

  const filtered = useMemo(
    () => rawMaterials
      .filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [rawMaterials, search],
  );

  const openAdjust = (material: RawMaterial) => {
    setSelected(material);
    setMode('OPNAME');
    setAmount('');
    setReason('');
  };

  // Stok baru (absolut) hasil dari mode + input.
  const resultingStock = (() => {
    if (!selected) return 0;
    const value = Number(amount) || 0;
    if (mode === 'IN') return selected.stockQuantity + value;
    if (mode === 'OUT') return selected.stockQuantity - value;
    return value; // OPNAME: input = stok fisik absolut
  })();
  const variance = selected ? resultingStock - selected.stockQuantity : 0;

  const submit = async () => {
    if (!selected) return;
    const value = Number(amount);
    if (mode === 'OPNAME') {
      if (amount === '' || value < 0) { onShowToast('Isi Angka', 'Masukkan jumlah stok fisik hasil hitung (boleh 0).'); return; }
    } else {
      if (!value || value <= 0) { onShowToast('Isi Jumlah', 'Masukkan jumlah yang lebih dari 0.'); return; }
    }
    if (mode === 'OUT' && value > selected.stockQuantity) {
      onShowToast('Melebihi Stok', `Stok keluar (${fmt(value)}) melebihi stok sistem (${fmt(selected.stockQuantity)} ${selected.unit}).`);
      return;
    }
    const meta = MODE_META[mode];
    const autoReason = mode === 'OPNAME'
      ? `Opname fisik: ${fmt(selected.stockQuantity)} → ${fmt(resultingStock)} (selisih ${variance >= 0 ? '+' : ''}${fmt(variance)})`
      : `${meta.label} ${fmt(value)} ${selected.unit}`;
    setSaving(true);
    try {
      await adjustStockManual(selected.id, resultingStock, meta.type, reason.trim() || autoReason);
      onShowToast('Stok Disesuaikan', `${selected.name}: ${fmt(selected.stockQuantity)} → ${fmt(resultingStock)} ${selected.unit}.`);
      setSelected(null);
      await onRefresh();
      await loadMovements();
    } catch (err) {
      onShowToast('Gagal', err instanceof Error ? err.message : 'Penyesuaian stok gagal.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-card)] p-4">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-[var(--primary-hover)]" />
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Stok Opname & Kontrol Keluar-Masuk</h3>
            <p className="text-[11px] font-semibold text-[var(--text-tertiary)]">Jalur <b className="text-emerald-700">Masuk</b>, <b className="text-rose-700">Keluar</b>, dan <b className="text-sky-700">Opname fisik</b> dipisah. Setiap perubahan otomatis tercatat di riwayat.</p>
          </div>
        </div>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari bahan…" className="ui-input pl-9 text-[12px]" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--panel-border)] p-10 text-center">
          <PackageSearch className="mx-auto mb-2 h-7 w-7 text-[var(--text-tertiary)]" />
          <p className="text-sm font-bold text-[var(--text-tertiary)]">Tidak ada bahan cocok.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((m) => {
            const low = m.stockQuantity <= m.minStockThreshold;
            return (
              <div key={m.id} className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-card)] p-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold text-[var(--text-primary)]">{m.name}</p>
                  <p className="text-[11px] font-semibold text-[var(--text-tertiary)]">
                    Stok sistem: <span className="font-mono font-bold text-[var(--text-primary)]">{fmt(m.stockQuantity)}</span> {m.unit}
                    {low && <span className="ml-1.5 rounded bg-[var(--warning-soft)] px-1.5 py-0.5 text-[9px] font-black text-[#b45309]">MENIPIS</span>}
                  </p>
                </div>
                <button type="button" onClick={() => openAdjust(m)} className="ui-button ui-button-secondary shrink-0 text-[11px]" style={{ minHeight: '34px', padding: '0 12px' }}>
                  Sesuaikan
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Riwayat penyesuaian terbaru */}
      {movements.length > 0 && (
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-card)] p-4">
          <div className="mb-2 flex items-center gap-2">
            <History className="h-4 w-4 text-[var(--text-tertiary)]" />
            <h4 className="text-[12px] font-bold text-[var(--text-primary)]">Penyesuaian Stok Terbaru</h4>
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {movements.map((row) => {
              const isIn = row.quantity > 0;
              return (
                <div key={row.id} className="flex items-center justify-between gap-2 border-b border-[var(--panel-border-light)] py-1.5 last:border-0 text-[11px]">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-[var(--text-primary)]">{row.rawMaterialName || 'Bahan'} <span className="font-normal text-[var(--text-tertiary)]">· {STOCK_MOVEMENT_LABELS[row.type]}</span></p>
                    <p className="text-[10px] text-[var(--text-tertiary)]">{new Date(row.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}{row.reason ? ` · ${row.reason}` : ''}</p>
                  </div>
                  <div className="shrink-0 text-right font-mono">
                    <span className="font-bold" style={{ color: isIn ? 'var(--accent-green)' : 'var(--accent-red)' }}>{isIn ? '+' : ''}{fmt(row.quantity)}</span>
                    <p className="text-[10px] text-[var(--text-tertiary)]">{fmt(row.stockBefore)} → {fmt(row.stockAfter)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal penyesuaian */}
      {selected && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md" style={{ background: 'rgba(24,24,27,0.45)' }}>
          <div className="w-full max-w-md rounded-2xl border bg-[var(--surface-card)] p-5" style={{ borderColor: 'var(--panel-border)' }}>
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Sesuaikan Stok</h3>
                <p className="text-[12px] font-semibold text-[var(--text-secondary)]">{selected.name} · Sistem {fmt(selected.stockQuantity)} {selected.unit}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="ui-icon-button h-8 w-8"><X className="h-4 w-4" /></button>
            </div>

            {/* Segmented mode — jalur terpisah */}
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-[var(--surface-secondary)] p-1">
              {(['IN', 'OUT', 'OPNAME'] as Mode[]).map((mKey) => {
                const Icon = mKey === 'IN' ? ArrowDownCircle : mKey === 'OUT' ? ArrowUpCircle : ClipboardCheck;
                return (
                  <button key={mKey} type="button" onClick={() => { setMode(mKey); setAmount(''); }}
                    className={`flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-bold transition-colors ${mode === mKey ? 'bg-[var(--primary)] text-white shadow-sm' : 'text-[var(--text-secondary)]'}`}>
                    <Icon className="h-3.5 w-3.5" /> {MODE_META[mKey].label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] font-semibold text-[var(--text-tertiary)]">{MODE_META[mode].hint}</p>

            <div className="mt-3">
              <label className="mb-1 block text-[11px] font-bold uppercase text-[var(--text-tertiary)]">
                {mode === 'OPNAME' ? `Stok fisik aktual (${selected.unit})` : `Jumlah ${mode === 'IN' ? 'masuk' : 'keluar'} (${selected.unit})`}
              </label>
              <input type="number" min={0} inputMode="decimal" value={amount}
                onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0" className="ui-input w-full font-mono text-lg" autoFocus />
            </div>

            <div className="mt-2">
              <label className="mb-1 block text-[11px] font-bold uppercase text-[var(--text-tertiary)]">Keterangan (opsional)</label>
              <input type="text" value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder={mode === 'IN' ? 'mis. belanja pasar' : mode === 'OUT' ? 'mis. rusak / expired' : 'mis. opname sore'}
                className="ui-input w-full text-[12px]" />
            </div>

            {/* Pratinjau hasil */}
            <div className="mt-3 flex items-center justify-between rounded-xl border px-4 py-2.5" style={{ borderColor: 'var(--panel-border)', background: 'var(--surface-secondary)' }}>
              <span className="text-[11px] font-bold text-[var(--text-secondary)]">Stok setelah disimpan</span>
              <span className="text-right">
                <span className="font-mono text-base font-black text-[var(--text-primary)]">{fmt(Math.max(0, resultingStock))} {selected.unit}</span>
                {amount !== '' && (
                  <span className={`ml-2 text-[11px] font-bold ${variance > 0 ? 'text-emerald-600' : variance < 0 ? 'text-rose-600' : 'text-[var(--text-tertiary)]'}`}>
                    ({variance >= 0 ? '+' : ''}{fmt(variance)})
                  </span>
                )}
              </span>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setSelected(null)} className="ui-button ui-button-secondary">Batal</button>
              <button type="button" disabled={saving} onClick={() => void submit()} className="ui-button ui-button-primary">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />} Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
