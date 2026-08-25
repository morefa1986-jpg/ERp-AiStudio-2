import { describe, expect, it } from 'vitest';
import { aggregateSeries, compareAggregates, shiftedRange } from '../utils/analyticsEngine';

describe('comparative analytics engine', () => {
  it('aggregates daily data and compares the same calendar day two years ago', () => {
    const currentRange = { from: '2026-08-24', to: '2026-08-24' };
    const previousRange = shiftedRange(currentRange.from, currentRange.to, { id: 'two-years', label: 'دو سال قبل', offsetYears: -2 });
    expect(previousRange).toEqual({ from: '2024-08-24', to: '2024-08-24' });

    const points = [
      { date: '2026-08-24T08:00:00.000Z', value: 12 },
      { date: '2026-08-24T16:00:00.000Z', value: 8 },
      { date: '2024-08-24T08:00:00.000Z', value: 10 },
      { date: '2024-08-24T16:00:00.000Z', value: 5 },
    ];

    const current = aggregateSeries(points, 'daily', currentRange.from, currentRange.to);
    const previous = aggregateSeries(points, 'daily', previousRange.from, previousRange.to);
    const [row] = compareAggregates(current, previous);
    expect(row.value).toBe(20);
    expect(row.previousValue).toBe(15);
    expect(row.delta).toBe(5);
    expect(row.deltaPercent).toBe(33.33);
  });

  it('creates empty buckets so weekly and monthly charts preserve comparable periods', () => {
    const rows = aggregateSeries([{ date: '2026-08-01', value: 3 }], 'daily', '2026-08-01', '2026-08-03');
    expect(rows.map((row) => row.value)).toEqual([3, 0, 0]);
  });
});
