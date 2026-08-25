import React, { useMemo, useState } from 'react';
import { AlertTriangle, Building, DollarSign, Globe, Mail, Phone, Plus, Printer, Trash2, Users } from 'lucide-react';
import { nextId, nextReference } from '../../utils/id';
import { useI18n } from '../../i18n';
import { useFarm } from '../../context/FarmContext';
import { useAuth } from '../../context/AuthContext';
import { ColdStoragePallet, Customer, ProcessingBatch, ProformaInvoice } from '../../types';

type DraftLine = { id: string; lotKey: string; quantity: string; unitPrice: string };

function lotSku(lot: { sku?: string; batchCode: string; productType: string }): string {
  if (lot.sku?.trim()) return lot.sku.trim();
  if (lot.productType.includes('Caviar')) return `CAV-${lot.batchCode}`;
  if (lot.productType.includes('Fillet')) return `FIL-${lot.batchCode}`;
  if (lot.productType.includes('Smoked')) return `SMK-${lot.batchCode}`;
  return `WHOLE-${lot.batchCode}`;
}

function processingOrigin(lot: ColdStoragePallet, batches: ProcessingBatch[]): ProcessingBatch | undefined {
  if (lot.processingBatchId) return batches.find((batch) => batch.id === lot.processingBatchId);
  const byOutputLot = batches.filter((batch) => Array.isArray(batch.outputLotIds) && batch.outputLotIds.includes(lot.id));
  if (byOutputLot.length === 1) return byOutputLot[0];
  return undefined;
}

function requiresProcessingOrigin(lot: ColdStoragePallet): boolean {
  return lot.productType === 'Caviar (Cans/Jars)'
    || lot.productType === 'Vacuumed Fillet'
    || lot.productType === 'Smoked Sturgeon'
    || lot.productType === 'Frozen Sturgeon Whole';
}

export const SalesCrmView: React.FC = () => {
  const { formatNumber, formatCurrency } = useI18n();
  const { hasPermission } = useAuth();
  const { customers, proformas, coldStorage, processingBatches, officeSettings, addCustomer, createProformaInvoice, updateProformaStage } = useFarm();
  const branding = officeSettings[0];
  const [tab, setTab] = useState<'sales' | 'customers'>('sales');
  const [showCustomer, setShowCustomer] = useState(false);
  const [showProforma, setShowProforma] = useState(false);
  const [printProforma, setPrintProforma] = useState<ProformaInvoice | null>(null);
  const [message, setMessage] = useState('');

  const [customerId, setCustomerId] = useState(customers[0]?.id || '');
  const [currency, setCurrency] = useState<ProformaInvoice['currency']>('IRR');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [deliveryTerms, setDeliveryTerms] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([{ id: nextId('draftline'), lotKey: '', quantity: '1', unitPrice: '0' }]);

  const [cust, setCust] = useState({ name: '', company: '', category: 'Export Luxury Distributor' as Customer['category'], phone: '', email: '', country: '', city: '', currency: 'IRR' });

  const sellableLots = useMemo(() => coldStorage.filter((lot) => {
    const expires = new Date(lot.expiryDate).getTime();
    const available = lot.unitsCount > 0 || lot.weightKg > 0.001;
    return available && Number.isFinite(expires) && expires >= Date.now() && lot.status !== 'Pending Dispatch' && !lot.qualityHold;
  }), [coldStorage]);

  const getLot = (key: string) => sellableLots.find((lot) => lot.id === key);
  const selectedCustomer = customers.find((item) => item.id === customerId);
  const exportSale = Boolean(selectedCustomer && (selectedCustomer.category === 'Export Luxury Distributor' || !['ایران', 'Iran', 'IR'].includes(selectedCustomer.country)));

  const createSale = (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    if (!hasPermission('sales', 'create') || !selectedCustomer) return;
    const items: ProformaInvoice['items'] = [];
    const requestedByLot = new Map<string, number>();
    for (const line of lines) {
      const lot = getLot(line.lotKey);
      const quantity = Number(line.quantity);
      const unitPrice = Number(line.unitPrice);
      if (!lot || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) { setMessage('تمام خطوط فروش باید لات معتبر، مقدار مثبت و قیمت معتبر داشته باشند.'); return; }
      const packaged = lot.unitsCount > 0;
      const cumulative = (requestedByLot.get(lot.id) || 0) + quantity;
      requestedByLot.set(lot.id, cumulative);
      if (packaged && (!Number.isInteger(quantity) || cumulative > lot.unitsCount)) { setMessage(`تعداد تجمیعی بسته برای ${lot.batchCode} از موجودی همان لات بیشتر است.`); return; }
      if (!packaged && cumulative > lot.weightKg) { setMessage(`وزن تجمیعی درخواستی برای ${lot.batchCode} از موجودی همان لات بیشتر است.`); return; }
      const origin = processingOrigin(lot, processingBatches);
      if (requiresProcessingOrigin(lot) && !origin) { setMessage(`ردیابی مبدأ برای لات ${lot.id} کامل نیست؛ فروش تا اتصال قطعی لات به بچ فرآوری مسدود است.`); return; }
      if (exportSale && lot.productType.includes('Caviar') && !origin?.citesPermitNumber?.trim()) { setMessage(`فروش صادراتی خاویار از لات ${lot.id} بدون شماره CITES ثبت‌شده روی بچ فرآوری مسدود است.`); return; }
      items.push({
        id: nextId('item'),
        productName: `${lot.productType} — ${lot.batchCode}`,
        sku: lotSku(lot),
        coldStorageLotId: lot.id,
        processingBatchId: origin?.id,
        quantity,
        unit: packaged ? lot.packagingUnit || 'piece' : 'kg',
        unitPrice,
        taxPercent: 0,
        discount: 0,
        total: Number((quantity * unitPrice).toFixed(2)),
      });
    }
    if (!items.length) { setMessage('حداقل یک قلم فروش لازم است.'); return; }
    createProformaInvoice({
      invoiceNumber: nextReference(`PI-${new Date().getFullYear()}`),
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      customerCompany: selectedCustomer.companyName,
      customerCountry: selectedCustomer.country,
      date: new Date().toISOString().slice(0, 10),
      expiryDate: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
      stage: 'Proforma (پیش‌فاکتور)',
      items,
      taxTotal: 0,
      discountTotal: 0,
      currency,
      paymentTerms: paymentTerms.trim(),
      deliveryTerms: deliveryTerms.trim(),
      citesPermitRequired: exportSale && items.some((item) => item.sku.startsWith('CAV')),
      status: 'Sent',
    });
    setLines([{ id: nextId('draftline'), lotKey: '', quantity: '1', unitPrice: '0' }]);
    setShowProforma(false);
  };

  const changeStage = (proforma: ProformaInvoice, stage: ProformaInvoice['stage']) => {
    setMessage('');
    if (stage === 'Payment Received (تسویه)') {
      setMessage('مرحله «تسویه» موجودی سردخانه را مصرف نمی‌کند. ثبت پرداخت در گردش مالی مستقل انجام می‌شود؛ خروج فیزیکی فقط با «تحویل/ارسال» انجام می‌شود.');
      return;
    }
    if (stage === 'Dispatched / Delivery (تحویل)') {
      const invalidTrace = proforma.items.find((item) => {
        if (!item.coldStorageLotId) return true;
        const lot = coldStorage.find((candidate) => candidate.id === item.coldStorageLotId);
        if (!lot || lotSku(lot) !== item.sku) return true;
        const origin = processingOrigin(lot, processingBatches);
        return requiresProcessingOrigin(lot) && (!origin || (item.processingBatchId ? origin.id !== item.processingBatchId : false));
      });
      if (invalidTrace) { setMessage(`ارسال مسدود شد: شناسه لات/مبدأ برای ${invalidTrace.productName} کامل یا سازگار نیست.`); return; }
      if (proforma.citesPermitRequired) {
        const missing = proforma.items.find((item) => {
          const lot = item.coldStorageLotId ? coldStorage.find((candidate) => candidate.id === item.coldStorageLotId) : undefined;
          if (!lot?.productType.includes('Caviar')) return false;
          const origin = processingOrigin(lot, processingBatches);
          return !origin?.citesPermitNumber?.trim();
        });
        if (missing) { setMessage(`ارسال مسدود شد: CITES برای ${missing.productName} ثبت نشده است.`); return; }
      }
    }
    updateProformaStage(proforma.id, stage);
  };

  const addCustomerSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!hasPermission('crm', 'create')) return;
    addCustomer({ name: cust.name.trim(), companyName: cust.company.trim(), category: cust.category, phone: cust.phone.trim(), email: cust.email.trim(), country: cust.country.trim(), city: cust.city.trim(), address: '', currency: cust.currency, status: 'Lead', notes: '' });
    setShowCustomer(false);
    setCust({ name: '', company: '', category: 'Export Luxury Distributor', phone: '', email: '', country: '', city: '', currency: 'IRR' });
  };

  return <div className="space-y-6 pb-12 animate-fadeIn">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div><h1 className="text-xl font-black text-white flex items-center gap-2"><DollarSign className="w-6 h-6 text-amber-400" />فروش، CRM و خروج کنترل‌شده از سردخانه</h1><p className="text-xs text-slate-400 mt-1">هر خط فروش به شناسه تغییرناپذیر لات سردخانه و بچ فرآوری متصل می‌شود؛ پرداخت معادل خروج فیزیکی نیست.</p></div>
      <div className="flex gap-2 text-xs"><button onClick={() => setTab('sales')} className={`px-3 py-2 rounded-xl font-bold ${tab === 'sales' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>فروش ({proformas.length})</button><button onClick={() => setTab('customers')} className={`px-3 py-2 rounded-xl font-bold ${tab === 'customers' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'}`}>مشتریان ({customers.length})</button></div>
    </div>

    {message && <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{message}</div>}

    {tab === 'sales' ? <div className="space-y-4"><div className="flex justify-end"><button disabled={!hasPermission('sales', 'create') || sellableLots.length === 0} onClick={() => setShowProforma(true)} className="px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-bold disabled:opacity-40"><Plus className="w-4 h-4 inline ml-1" />پیش‌فاکتور از موجودی واقعی</button></div><div className="grid grid-cols-1 xl:grid-cols-2 gap-3">{proformas.map((proforma) => <div key={proforma.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5"><div className="flex justify-between gap-3 border-b border-slate-800 pb-3"><div><strong className="text-amber-400 font-mono">{proforma.invoiceNumber}</strong><p className="text-xs text-white mt-1">{proforma.customerName} · {proforma.customerCountry}</p></div><span className="text-[10px] text-slate-400">{proforma.stage}</span></div><div className="space-y-1 mt-3">{proforma.items.map((item) => <div key={item.id} className="flex justify-between text-xs"><span className="text-slate-300">{item.productName} · {formatNumber(item.quantity)} {item.unit}<span className="block text-[9px] text-slate-600 font-mono">Lot: {item.coldStorageLotId || 'legacy/unbound'}</span></span><strong className="text-amber-400">{formatCurrency(item.total, proforma.currency)}</strong></div>)}</div><div className="flex justify-between border-t border-slate-800 mt-3 pt-3"><strong className="text-white text-xs">جمع</strong><strong className="text-amber-400">{formatCurrency(proforma.grandTotal, proforma.currency)}</strong></div><div className="flex flex-wrap gap-2 mt-4"><select value={proforma.stage} disabled={!hasPermission('sales', 'edit') || Boolean(proforma.fulfilledAt)} onChange={(event) => changeStage(proforma, event.target.value as ProformaInvoice['stage'])} className="flex-1 bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white"><option value="Draft">پیش‌نویس</option><option value="Proforma (پیش‌فاکتور)">پیش‌فاکتور</option><option value="Order Confirmed (تایید سفارش)">سفارش قطعی</option><option value="Invoice Issued (صدور فاکتور)">صدور فاکتور</option><option value="Payment Received (تسویه)">تسویه (نیازمند گردش مالی مستقل)</option><option value="Dispatched / Delivery (تحویل)">تحویل/ارسال — کسر موجودی</option></select><button disabled={!hasPermission('sales', 'print')} onClick={() => setPrintProforma(proforma)} className="px-3 py-2 bg-slate-800 text-slate-200 rounded-lg"><Printer className="w-4 h-4" /></button></div>{proforma.fulfilledAt && <div className="mt-2 text-[10px] text-emerald-400">خروج فیزیکی ثبت شد: {proforma.fulfilledAt}</div>}</div>)}</div></div> : <div className="space-y-4"><div className="flex justify-end"><button disabled={!hasPermission('crm', 'create')} onClick={() => setShowCustomer(true)} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"><Plus className="w-4 h-4 inline ml-1" />مشتری جدید</button></div><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{customers.map((customer) => <div key={customer.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5"><div className="flex justify-between border-b border-slate-800 pb-3"><div><strong className="text-white block">{customer.name}</strong><span className="text-amber-400 text-[10px]">{customer.category}</span></div><span className="text-[10px] text-slate-500">{customer.status}</span></div><div className="space-y-2 mt-3 text-xs text-slate-300"><div className="flex gap-2"><Building className="w-4 h-4 text-slate-500" />{customer.companyName}</div><div className="flex gap-2"><Globe className="w-4 h-4 text-slate-500" />{customer.city}، {customer.country}</div><div className="flex gap-2"><Phone className="w-4 h-4 text-slate-500" />{customer.phone}</div><div className="flex gap-2"><Mail className="w-4 h-4 text-slate-500" />{customer.email || '—'}</div></div></div>)}</div></div>}

    {showProforma && <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"><div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-6 w-full max-w-4xl max-h-[92vh] overflow-auto"><h2 className="text-white font-bold mb-4">پیش‌فاکتور مبتنی بر لات سردخانه</h2><form onSubmit={createSale} className="space-y-4 text-xs"><div className="grid md:grid-cols-2 gap-3"><label className="text-slate-400">مشتری<select value={customerId} onChange={(event) => setCustomerId(event.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" required><option value="">انتخاب...</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} — {customer.country}</option>)}</select></label><label className="text-slate-400">ارز<select value={currency} onChange={(event) => setCurrency(event.target.value as ProformaInvoice['currency'])} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"><option>IRR</option><option>USD</option><option>EUR</option><option>AED</option><option>RUB</option></select></label></div><div className="space-y-2">{lines.map((line) => { const lot = getLot(line.lotKey); const origin = lot ? processingOrigin(lot, processingBatches) : undefined; return <div key={line.id} className="grid grid-cols-12 gap-2 items-end bg-slate-900 border border-slate-800 rounded-xl p-3"><label className="col-span-12 md:col-span-6 text-slate-400">لات محصول<select value={line.lotKey} onChange={(event) => setLines((previous) => previous.map((item) => item.id === line.id ? { ...item, lotKey: event.target.value } : item))} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white" required><option value="">انتخاب...</option>{sellableLots.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.productType} · {candidate.batchCode} · {lotSku(candidate)} · Lot {candidate.id} · {candidate.unitsCount > 0 ? `${candidate.unitsCount} ${candidate.packagingUnit}` : `${candidate.weightKg} kg`}</option>)}</select></label><label className="col-span-5 md:col-span-2 text-slate-400">مقدار<input type="number" min="0.001" step={lot?.unitsCount ? '1' : '0.001'} value={line.quantity} onChange={(event) => setLines((previous) => previous.map((item) => item.id === line.id ? { ...item, quantity: event.target.value } : item))} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white" /></label><label className="col-span-5 md:col-span-3 text-slate-400">قیمت واحد<input type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => setLines((previous) => previous.map((item) => item.id === line.id ? { ...item, unitPrice: event.target.value } : item))} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white" /></label><button type="button" disabled={lines.length <= 1} onClick={() => setLines((previous) => previous.filter((item) => item.id !== line.id))} className="col-span-2 md:col-span-1 p-2 text-rose-400 disabled:opacity-30"><Trash2 className="w-4 h-4" /></button>{lot && <div className="col-span-12 text-[10px] text-slate-500">Lot ID: {lot.id} · Processing: {origin?.id || 'ردیابی ناقص'} · انقضا: {lot.expiryDate} · CITES: {origin?.citesPermitNumber || 'ثبت نشده'}</div>}</div>; })}</div><button type="button" onClick={() => setLines((previous) => [...previous, { id: nextId('draftline'), lotKey: '', quantity: '1', unitPrice: '0' }])} className="px-3 py-2 bg-slate-800 text-slate-300 rounded-lg">+ قلم دیگر</button><div className="grid md:grid-cols-2 gap-3"><input value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value)} placeholder="شرایط پرداخت" className="bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" /><input value={deliveryTerms} onChange={(event) => setDeliveryTerms(event.target.value)} placeholder="شرایط تحویل / Incoterm" className="bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" /></div><div className="flex justify-end gap-2"><button type="button" onClick={() => setShowProforma(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">انصراف</button><button type="submit" className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl">صدور پیش‌فاکتور</button></div></form></div></div>}

    {showCustomer && <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"><div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 w-full max-w-xl"><h2 className="text-white font-bold mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-emerald-400" />مشتری جدید</h2><form onSubmit={addCustomerSubmit} className="grid grid-cols-2 gap-3 text-xs"><input value={cust.name} onChange={(event) => setCust({ ...cust, name: event.target.value })} placeholder="نام" required className="col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" /><input value={cust.company} onChange={(event) => setCust({ ...cust, company: event.target.value })} placeholder="شرکت" required className="col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" /><input value={cust.country} onChange={(event) => setCust({ ...cust, country: event.target.value })} placeholder="کشور" required className="bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" /><input value={cust.city} onChange={(event) => setCust({ ...cust, city: event.target.value })} placeholder="شهر" required className="bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" /><input value={cust.phone} onChange={(event) => setCust({ ...cust, phone: event.target.value })} placeholder="تلفن" className="bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" /><input type="email" value={cust.email} onChange={(event) => setCust({ ...cust, email: event.target.value })} placeholder="ایمیل" className="bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white" /><select value={cust.category} onChange={(event) => setCust({ ...cust, category: event.target.value as Customer['category'] })} className="bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"><option>Export Luxury Distributor</option><option>5-Star Hotel / Restaurant</option><option>Domestic Gourmet Chain</option><option>Private VIP Client</option><option>Aquaculture Farm (Fingerlings)</option></select><select value={cust.currency} onChange={(event) => setCust({ ...cust, currency: event.target.value })} className="bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"><option>IRR</option><option>USD</option><option>EUR</option><option>AED</option><option>RUB</option></select><div className="col-span-2 flex justify-end gap-2"><button type="button" onClick={() => setShowCustomer(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">انصراف</button><button type="submit" className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl">ثبت مشتری</button></div></form></div></div>}

    {printProforma && <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"><div className="bg-white text-slate-900 rounded-2xl p-8 w-full max-w-3xl max-h-[90vh] overflow-auto"><div className="flex justify-between border-b pb-4">{branding?.letterheadDataUrl ? <img src={branding.letterheadDataUrl} alt="Letterhead" className="max-h-24 object-contain" /> : <div className="flex gap-3">{branding?.logoDataUrl && <img src={branding.logoDataUrl} alt="Logo" className="w-14 h-14 object-contain" />}<div><h2 className="text-xl font-black">{branding?.companyNameEn || 'Fathi Aqua'} — Proforma Invoice</h2><div className="text-sm font-bold">{branding?.companyNameFa}</div><span className="text-xs text-slate-500">{branding?.registrationLine}</span></div></div>}<button onClick={() => setPrintProforma(null)} className="text-slate-500">×</button></div><div className="grid grid-cols-2 gap-3 mt-4 text-sm"><div>Invoice No: <strong className="font-mono">{printProforma.invoiceNumber}</strong></div><div>Date: {printProforma.date}</div><div className="col-span-2">Customer: <strong>{printProforma.customerName}</strong> · {printProforma.customerCompany} · {printProforma.customerCountry}</div></div><table className="w-full text-sm mt-4"><thead><tr className="border-b"><th className="text-left p-2">Product</th><th className="p-2">Qty</th><th className="p-2">Total</th></tr></thead><tbody>{printProforma.items.map((item) => <tr key={item.id} className="border-b"><td className="p-2">{item.productName}<div className="text-xs font-mono">{item.sku}</div><div className="text-[9px] font-mono text-slate-500">Lot {item.coldStorageLotId || 'legacy'}</div></td><td className="p-2 text-center">{item.quantity} {item.unit}</td><td className="p-2 text-center">{formatCurrency(item.total, printProforma.currency)}</td></tr>)}</tbody></table><div className="mt-4 text-right font-black">Grand Total: {formatCurrency(printProforma.grandTotal, printProforma.currency)}</div><div className="mt-8 flex justify-between items-end text-xs"><div className="text-slate-500">{branding?.invoiceFooterNote}</div><div className="flex gap-4 items-end">{branding?.stampDataUrl && <img src={branding.stampDataUrl} alt="Stamp" className="w-20 h-20 object-contain" />}{branding?.signatureDataUrl && <div className="text-center"><img src={branding.signatureDataUrl} alt="Signature" className="w-28 h-16 object-contain" /><div className="border-t pt-1">امضا مجاز</div></div>}</div></div><div className="mt-6 flex justify-end gap-2 print:hidden"><button onClick={() => window.print()} className="px-4 py-2 bg-slate-900 text-white rounded-lg">Print</button><button onClick={() => setPrintProforma(null)} className="px-4 py-2 bg-slate-200 rounded-lg">Close</button></div></div></div>}
  </div>;
};
