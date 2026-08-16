import React from 'react';
import { ChefHat, Smartphone } from 'lucide-react';
import type { CondimentGroup } from '../../types/pos';

const normalize = (value: string) => value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

const inferRole = (group: CondimentGroup): 'NONE' | 'BROTH' | 'FILLING' => {
  if (group.selfOrderRole) return group.selfOrderRole;
  const name = normalize(group.name);
  if (name.includes('KUAH')) return 'BROTH';
  if (name.includes('ISIAN')) return 'FILLING';
  return 'NONE';
};

export const CondimentPreviewPanel: React.FC<{ group: CondimentGroup }> = ({ group }) => {
  const activeOptions = group.options.filter((option) => option.isAvailable !== false);
  const required = group.required === true || group.isRequired === true || (group.minSelect || 0) > 0;
  const role = inferRole(group);
  const isSingle = group.mode === 'PAKET' || group.maxSelect === 1;
  const customerDefault = role === 'BROTH'
    ? (group.selfOrderDefaultOptions || []).join(', ')
    : role === 'FILLING'
      ? (group.selfOrderCampurOptions || []).join(', ')
      : '';
  const kitchenLabel = role === 'FILLING' && group.allSelectedLabel
    ? group.allSelectedLabel
    : customerDefault || activeOptions.slice(0, 4).map((option) => option.name).join(', ');

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <section className="rounded-2xl border border-orange-100 bg-[#fffaf7] p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-100 text-orange-600"><Smartphone className="h-4 w-4" /></span>
            <div><p className="text-[10px] font-black text-slate-900">PREVIEW CUSTOMER</p><p className="text-[9px] font-semibold text-slate-500">{isSingle ? 'Pilih satu' : 'Pilih beberapa'} · {required ? 'Wajib' : 'Opsional'}</p></div>
          </div>
          <span className="rounded-full bg-white px-2 py-1 text-[8px] font-black text-orange-600">{role === 'BROTH' ? 'KUAH' : role === 'FILLING' ? 'ISIAN' : 'NORMAL'}</span>
        </div>
        <div className="mt-3 space-y-1.5">
          {activeOptions.slice(0, 6).map((option, index) => {
            const selected = customerDefault.split(',').map(normalize).includes(normalize(option.name)) || (!customerDefault && index === 0 && required && isSingle);
            return (
              <div key={option.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-bold ${selected ? 'border-orange-300 bg-white text-orange-700' : 'border-slate-200 bg-white text-slate-600'}`}>
                <span className={`flex h-4 w-4 items-center justify-center ${isSingle ? 'rounded-full' : 'rounded'} border ${selected ? 'border-orange-500 bg-orange-500' : 'border-slate-300'}`}>{selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}</span>
                <span className="flex-1">{option.name}</span>
                {option.price > 0 && <span className="text-[8px] text-orange-600">+Rp {option.price.toLocaleString('id-ID')}</span>}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-100 bg-emerald-50/45 p-3.5">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><ChefHat className="h-4 w-4" /></span>
          <div><p className="text-[10px] font-black text-slate-900">PREVIEW KITCHEN</p><p className="text-[9px] font-semibold text-slate-500">Ringkasan yang dibaca dapur</p></div>
        </div>
        <div className="mt-3 rounded-xl border border-emerald-100 bg-white p-3">
          <div className="grid grid-cols-[64px_1fr] gap-2 text-[10px] leading-snug">
            <span className="font-black uppercase tracking-wide text-slate-400">{role === 'BROTH' ? 'KUAH' : role === 'FILLING' ? 'ISIAN' : group.name}</span>
            <span className="font-black text-slate-900">{kitchenLabel || 'Pilihan customer akan tampil di sini'}</span>
          </div>
        </div>
      </section>
    </div>
  );
};
