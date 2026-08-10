export type ReportPeriod = 'TODAY' | 'YESTERDAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'ALL';

export interface PeriodRange {
  start: Date;
  end: Date;
}

export const REPORT_PERIODS: { key: ReportPeriod; label: string; hint: string }[] = [
  { key: 'TODAY', label: 'Hari Ini', hint: 'Performa berjalan hari ini' },
  { key: 'YESTERDAY', label: 'Kemarin', hint: 'Penjualan satu hari sebelumnya' },
  { key: 'WEEK', label: 'Minggu Ini', hint: 'Senin sampai hari ini' },
  { key: 'MONTH', label: 'Bulan Ini', hint: 'Tanggal 1 sampai hari ini' },
  { key: 'YEAR', label: 'Tahun Ini', hint: 'Januari sampai hari ini' },
  { key: 'ALL', label: 'Semua', hint: 'Seluruh riwayat tersimpan' }
];

const startOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const getPeriodRange = (period: ReportPeriod, now: Date = new Date()): PeriodRange => {
  const today = startOfDay(now);

  switch (period) {
    case 'TODAY':
      return { start: today, end: addDays(today, 1) };
    case 'YESTERDAY':
      return { start: addDays(today, -1), end: today };
    case 'WEEK': {
      // Minggu kerja dimulai Senin (getDay: Minggu = 0).
      const dayOffset = (now.getDay() + 6) % 7;
      return { start: addDays(today, -dayOffset), end: addDays(today, 1) };
    }
    case 'MONTH':
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: addDays(today, 1) };
    case 'YEAR':
      return { start: new Date(now.getFullYear(), 0, 1), end: addDays(today, 1) };
    case 'ALL':
    default:
      return { start: new Date(0), end: new Date(8640000000000000) };
  }
};

export const isWithinPeriod = (isoDate: string | undefined, range: PeriodRange): boolean => {
  if (!isoDate) return false;
  const time = new Date(isoDate).getTime();
  if (Number.isNaN(time)) return false;
  return time >= range.start.getTime() && time < range.end.getTime();
};

export const formatPeriodRange = (period: ReportPeriod, range: PeriodRange): string => {
  if (period === 'ALL') return 'Seluruh riwayat';

  const fmt = (date: Date) => date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  const lastDay = new Date(range.end.getTime() - 1);
  const startLabel = fmt(range.start);
  const endLabel = fmt(lastDay);
  return startLabel === endLabel ? startLabel : `${startLabel} — ${endLabel}`;
};
