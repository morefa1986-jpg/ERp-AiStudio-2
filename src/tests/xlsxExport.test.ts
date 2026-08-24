import { describe, expect, it } from 'vitest';
import { buildXlsxBytes } from '../utils/xlsxExport';

describe('xlsxExport', () => {
  it('builds a real XLSX zip package with worksheet data', () => {
    const bytes = buildXlsxBytes('گزارش فروش', [
      { invoice: 'PF-001', customer: 'Acme', total: 1250, paid: false },
      { invoice: 'PF-002', customer: 'Fathi Aqua', total: 2800, paid: true },
    ], ['invoice', 'customer', 'total', 'paid']);

    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);

    const decoded = new TextDecoder().decode(bytes);
    expect(decoded).toContain('[Content_Types].xml');
    expect(decoded).toContain('xl/workbook.xml');
    expect(decoded).toContain('xl/worksheets/sheet1.xml');
    expect(decoded).toContain('PF-001');
    expect(decoded).toContain('Fathi Aqua');
    expect(decoded).toContain('<v>1250</v>');
  });
});
