import { ProformaInvoice } from '../types';

export type ReceivableBucket = 'Not Due' | '1-30' | '31-60' | '61-90' | '90+';

export interface ReceivablePayment {
  id: string;
  proformaId?: string;
  invoiceNumber?: string;
  date: string;
  amount: number;
  currency: ProformaInvoice['currency'];
  status?: 'Posted' | 'Voided' | 'Draft';
}

export interface ReceivableAgingRow {
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  customerCompany: string;
  customerCountry: string;
  invoiceDate: string;
  dueDate: string;
  currency: ProformaInvoice['currency'];
  originalAmount: number;
  paidAmount: number;
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

function paymentMatches(invoice: ProformaInvoice, payment: ReceivablePayment): boolean {
  return Boolean((payment.proformaId && payment.proformaId === invoice.id) || (payment.invoiceNumber && payment.invoiceNumber === invoice.invoiceNumber));
}

function postedPaymentAmount(invoice: ProformaInvoice, asOfIso: string, payments: ReceivablePayment[]): number {
  const total = payments
    .filter((payment) => paymentMatches(invoice, payment))
    .filter((payment) => payment.currency === invoice.currency)
    .filter((payment) => (payment.status || 'Posted') === 'Posted')
    .filter((payment) => daysBetween(payment.date, asOfIso) >= 0)
    .reduce((sum, payment) => sum + Math.max(0, Number(payment.amount) || 0), 0);
  return Number(total.toFixed(2));
}

export function buildReceivablesAging(proformas: ProformaInvoice[], asOfIso: string, payments: ReceivablePayment[] = []): ReceivableAgingRow[] {
  return proformas
    .filter((invoice) => !PAID_OR_CLOSED_STAGES.has(invoice.stage) && !INACTIVE_STATUSES.has(invoice.status) && invoice.grandTotal > 0)
    .map((invoice) => {
      const dueDate = invoice.expiryDate || invoice.date;
      const paidAmount = postedPaymentAmount(invoice, asOfIso, payments);
      const originalAmount = Number(invoice.grandTotal.toFixed(2));
      const amountDue = Number(Math.max(0, originalAmount - paidAmount).toFixed(2));
      return {
        invoiceNumber: invoice.invoiceNumber,
        customerId: invoice.customerId,
        customerName: invoice.customerName,
        customerCompany: invoice.customerCompany,
        customerCountry: invoice.customerCountry,
        invoiceDate: invoice.date,
        dueDate,
        currency: invoice.currency,
        originalAmount,
        paidAmount: Math.min(originalAmount, paidAmount),
        amountDue,
        daysOverdue: Math.max(0, daysBetween(dueDate, asOfIso)),
        bucket: bucket(Math.max(0, daysBetween(dueDate, asOfIso))),
        stage: invoice.stage,
        status: invoice.status,
      };
    })
    .filter((row) => row.amountDue > 0)
    .sort((a, b) => b.daysOverdue - a.daysOverdue || b.amountDue - a.amountDue);
}

export function summarizeReceivables(rows: ReceivableAgingRow[]): Record<ReceivableBucket, number> {
  const result: Record<ReceivableBucket, number> = { 'Not Due': 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  for (const row of rows) result[row.bucket] = Number((result[row.bucket] + row.amountDue).toFixed(2));
  return result;
}
