type Grain = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface AnalyticsPoint {
  date: string;
  value: number;
  label?: string;
}

export interface AnalyticsSeries {
  id: string;
  label: string;
  points: AnalyticsPoint[];
}

export interface ComparisonPeriod {
  id: string;
  label: string;
  offsetDays?: number;
  offsetYears?: number;
}

export interface AggregatedPeriod {
  key: string;
  label: string;
  start: string;
  end: string;
  value: number;
}

const DAY_MS = 86_400_000;

function pad(value: number): string { return String(value).padStart(2, '0'); }
function isoDate(date: Date): string { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function localDate(value: string | Date): Date {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
function addDays(date: Date, days: number): Date { const next = new Date(date); next.setDate(next.getDate() + days); return next; }
function addYears(date: Date, years: number): Date { const next = new Date(date); next.setFullYear(next.getFullYear() + years); return next; }
function startOfWeek(date: Date): Date { const d = localDate(date); const day = (d.getDay() + 6) % 7; return addDays(d, -day); }
function endOfMonth(date: Date): Date { return new Date(date.getFullYear(), date.getMonth() + 1, 0); }
function periodStart(date: Date, grain: Grain): Date {
  const d = localDate(date);
  if (grain === 'daily') return d;
  if (grain === 'weekly') return startOfWeek(d);
  if (grain === 'monthly') return new Date(d.getFullYear(), d.getMonth(), 1);
  return new Date(d.getFullYear(), 0, 1);
}
function periodEnd(start: Date, grain: Grain): Date {
  if (grain === 'daily') return start;
  if (grain === 'weekly') return addDays(start, 6);
  if (grain === 'monthly') return endOfMonth(start);
  return new Date(start.getFullYear(), 11, 31);
}
function nextPeriod(start: Date, grain: Grain): Date {
  if (grain === 'daily') return addDays(start, 1);
  if (grain === 'weekly') return addDays(start, 7);
  if (grain === 'monthly') return new Date(start.getFullYear(), start.getMonth() + 1, 1);
  return new Date(start.getFullYear() + 1, 0, 1);
}
function periodKey(start: Date, grain: Grain): string {
  if (grain === 'daily') return isoDate(start);
  if (grain === 'weekly') return `${start.getFullYear()}-W${pad(Math.ceil((((start.getTime() - new Date(start.getFullYear(), 0, 1).getTime()) / DAY_MS) + 1) / 7))}`;
  if (grain === 'monthly') return `${start.getFullYear()}-${pad(start.getMonth() + 1)}`;
  return String(start.getFullYear());
}
function periodLabel(start: Date, grain: Grain): string {
  if (grain === 'daily') return isoDate(start);
  if (grain === 'weekly') return `${isoDate(start)} تا ${isoDate(periodEnd(start, grain))}`;
  if (grain === 'monthly') return `${start.getFullYear()}/${pad(start.getMonth() + 1)}`;
  return String(start.getFullYear());
}

export function aggregateSeries(points: AnalyticsPoint[], grain: Grain, from: string, to: string): AggregatedPeriod[] {
  const start = periodStart(localDate(from), grain);
  const final = periodEnd(periodStart(localDate(to), grain), grain);
  const totals = new Map<string, number>();
  for (const point of points) {
    const date = localDate(point.date);
    if (date.getTime() < start.getTime() || date.getTime() > final.getTime()) continue;
    const bucket = periodStart(date, grain);
    const key = periodKey(bucket, grain);
    totals.set(key, (totals.get(key) || 0) + Number(point.value || 0));
  }
  const rows: AggregatedPeriod[] = [];
  for (let cursor = start; cursor.getTime() <= final.getTime(); cursor = nextPeriod(cursor, grain)) {
    const key = periodKey(cursor, grain);
    const end = periodEnd(cursor, grain);
    rows.push({ key, label: periodLabel(cursor, grain), start: isoDate(cursor), end: isoDate(end), value: Number((totals.get(key) || 0).toFixed(4)) });
  }
  return rows;
}

export function shiftedRange(from: string, to: string, comparison: ComparisonPeriod): { from: string; to: string } {
  const start = localDate(from);
  const end = localDate(to);
  if (comparison.offsetYears) return { from: isoDate(addYears(start, comparison.offsetYears)), to: isoDate(addYears(end, comparison.offsetYears)) };
  return { from: isoDate(addDays(start, comparison.offsetDays || 0)), to: isoDate(addDays(end, comparison.offsetDays || 0)) };
}

export function compareAggregates(current: AggregatedPeriod[], previous: AggregatedPeriod[]): Array<AggregatedPeriod & { previousValue: number; delta: number; deltaPercent: number | null }> {
  return current.map((row, index) => {
    const previousValue = Number(previous[index]?.value || 0);
    const delta = Number((row.value - previousValue).toFixed(4));
    const deltaPercent = previousValue === 0 ? null : Number(((delta / previousValue) * 100).toFixed(2));
    return { ...row, previousValue, delta, deltaPercent };
  });
}

export function defaultDateRange(now: Date = new Date()): { from: string; to: string } {
  const today = localDate(now);
  return { from: isoDate(addDays(today, -30)), to: isoDate(today) };
}

export const COMPARISON_PERIODS: ComparisonPeriod[] = [
  { id: 'previous-period', label: 'دوره قبلی', offsetDays: -31 },
  { id: 'previous-week', label: 'هفته گذشته', offsetDays: -7 },
  { id: 'previous-month', label: 'ماه گذشته', offsetDays: -30 },
  { id: 'same-last-year', label: 'همین بازه در سال قبل', offsetYears: -1 },
  { id: 'same-two-years-ago', label: 'همین بازه در دو سال قبل', offsetYears: -2 },
];

export type { Grain };
