import { ProformaInvoice } from '../types';

export type ReceivableBucket = 'Not Due' | '1-30' | '31-60' | '61-90' | '90+';

export interface ReceivableAgingRow {
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  customerCompany: string;
  customerCountry: string;
  invoiceDate: string;
  dueDate: string;
  currency: ProformaInvoice['currency'];
  amountDue: number;
  daysOverdue: number;
  bucket: ReceivableBucket;
  stage: ProformaInvoice['stage'];
  status: ProformaInvoice['status'];
}

const PAID_OR_CLOSED_STAGES = new Set<ProformaInvoice['stage']>(['Payment Received (تسویه)', 'Closed Won (موفق)', 'Closed Lost (ناموفق)']);
const INACTIVE_STATUSES = new Set<ProformaInvoice['status']>(['Cancelled']);

function daysBetween(startIso: string, endIso: string): number {
  const start = new Date(`${startIso.slice(0, 10)}T00:00:00Z`).getTime();
  const end = new Date(`${endIso.slice(0, 10)}T00:00:00Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.floor((end - start) / 86_400_000);
}

function bucket(daysOverdue: number): ReceivableBucket {
  if (daysOverdue <= 0) return 'Not Due';
  if (daysOverdue <= 30) return '1-30';
  if (daysOverdue <= 60) return '31-60';
  if (daysOverdue <= 90) return '61-90';
  return '90+';
}

export function buildReceivablesAging(proformas: ProformaInvoice[], asOfIso: string): ReceivableAgingRow[] {
  return proformas
    .filter((invoice) => !PAID_OR_CLOSED_STAGES.has(invoice.stage) && !INACTIVE_STATUSES.has(invoice.status) && invoice.grandTotal > 0)
    .map((invoice) => {
      const dueDate = invoice.expiryDate || invoice.date;
      const daysOverdue = Math.max(0, daysBetween(dueDate, asOfIso));
      return {
        invoiceNumber: invoice.invoiceNumber,
        customerId: invoice.customerId,
        customerName: invoice.customerName,
        customerCompany: invoice.customerCompany,
        customerCountry: invoice.customerCountry,
        invoiceDate: invoice.date,
        dueDate,
        currency: invoice.currency,
        amountDue: Number(invoice.grandTotal.toFixed(2)),
        daysOverdue,
        bucket: bucket(daysOverdue),
        stage: invoice.stage,
        status: invoice.status,
      };
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue || b.amountDue - a.amountDue);
}

export function summarizeReceivables(rows: ReceivableAgingRow[]): Record<ReceivableBucket, number> {
  const result: Record<ReceivableBucket, number> = { 'Not Due': 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  for (const row of rows) result[row.bucket] = Number((result[row.bucket] + row.amountDue).toFixed(2));
  return result;
}
