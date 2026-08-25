import React, { useMemo, useState } from 'react';
import { AlertTriangle, Bell, Building, CalendarClock, CheckCircle2, DollarSign, FileUp, Globe, Mail, MessageSquare, Phone, Plus, Printer, Search, Tags, Trash2, Users } from 'lucide-react';
import { nextId, nextReference } from '../../utils/id';
import { useI18n } from '../../i18n';
import { useFarm } from '../../context/FarmContext';
import { useAuth } from '../../context/AuthContext';
import { ColdStoragePallet, CrmActivity, CrmReminder, Customer, ProcessingBatch, ProformaInvoice } from '../../types';
import { uploadLocalAttachment, sizeLabel } from '../../services/localFileService';

type DraftLine = { id: string; lotKey: string; quantity: string; unitPrice: string };
type Tab = 'dashboard' | 'customers' | 'sales' | 'activities' | 'reminders';

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
  return byOutputLot.length === 1 ? byOutputLot[0] : undefined;
}

function requiresProcessingOrigin(lot: ColdStoragePallet): boolean {
  return ['Caviar (Cans/Jars)', 'Vacuumed Fillet', 'Smoked Sturgeon', 'Frozen Sturgeon Whole'].includes(lot.productType);
}

const activityTypes: CrmActivity['type'][] = ['Call', 'Meeting', 'Message', 'Email', 'Visit', 'Note', 'Payment Follow-up', 'Complaint', 'Support'];
const activityOutcomes: CrmActivity['outcome'][] = ['Open', 'Done', 'Needs Follow-up', 'Waiting Customer', 'Closed'];

export const SalesCrmView: React.FC = () => {
  const { formatNumber, formatCurrency } = useI18n();
  const { hasPermission } = useAuth();
  const farm = useFarm();
  const { customers, crmActivities, crmReminders, proformas, coldStorage, processingBatches, officeSettings, employees } = farm;
  const branding = officeSettings[0];
  const [tab, setTab] = useState<Tab>('dashboard');
  const [query, setQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id || '');
  const [showCustomer, setShowCustomer] = useState(false);
  const [showProforma, setShowProforma] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [printProforma, setPrintProforma] = useState<ProformaInvoice | null>(null);
  const [message, setMessage] = useState('');

  const [customerId, setCustomerId] = useState(customers[0]?.id || '');
  const [currency, setCurrency] = useState<ProformaInvoice['currency']>('IRR');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [deliveryTerms, setDeliveryTerms] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([{ id: nextId('draftline'), lotKey: '', quantity: '1', unitPrice: '0' }]);
  const [cust, setCust] = useState({ name: '', company: '', category: 'Export Luxury Distributor' as Customer['category'], phone: '', email: '', country: '', city: '', currency: 'IRR', ownerName: '', tags: '', score: '50', notes: '' });
  const [activity, setActivity] = useState({ customerId: customers[0]?.id || '', type: 'Call' as CrmActivity['type'], subject: '', details: '', outcome: 'Needs Follow-up' as CrmActivity['outcome'], followUpAt: '', assignedTo: '', relatedProformaId: '' });
  const [activityFiles, setActivityFiles] = useState<File[]>([]);

  const sellableLots = useMemo(() => coldStorage.filter((lot) => {
    const expires = new Date(lot.expiryDate).getTime();
    const available = lot.unitsCount > 0 || lot.weightKg > 0.001;
    return available && Number.isFinite(expires) && expires >= Date.now() && lot.status !== 'Pending Dispatch' && !lot.qualityHold;
  }), [coldStorage]);

  const selectedCustomer = customers.find((item) => item.id === selectedCustomerId) || customers[0];
  const saleCustomer = customers.find((item) => item.id === customerId);
  const exportSale = Boolean(saleCustomer && (saleCustomer.category === 'Export Luxury Distributor' || !['ایران', 'Iran', 'IR'].includes(saleCustomer.country)));
  const today = new Date().toISOString().slice(0, 10);

  const filteredCustomers = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return customers;
    return customers.filter((customer) => [customer.name, customer.companyName, customer.phone, customer.email, customer.country, customer.city, customer.ownerName, ...(customer.tags || [])].join(' ').toLowerCase().includes(text));
  }, [customers, query]);

  const customerSales = (id: string) => proformas.filter((row) => row.customerId === id);
  const customerActivities = (id: string) => crmActivities.filter((row) => row.customerId === id);
  const customerReminders = (id: string) => crmReminders.filter((row) => row.customerId === id);
  const openReminders = crmReminders.filter((row) => row.status === 'Open').sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  const overdueReminders = openReminders.filter((row) => row.dueAt.slice(0, 10) < today);
  const totalPipeline = proformas.filter((row) => !['Cancelled'].includes(row.status) && !['Closed Lost (ناموفق)'].includes(row.stage)).reduce((sum, row) => sum + row.grandTotal, 0);

  const createSale = (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    if (!hasPermission('sales', 'create') || !saleCustomer) return;
    const items: ProformaInvoice['items'] = [];
    const requestedByLot = new Map<string, number>();
    for (const line of lines) {
      const lot = sellableLots.find((item) => item.id === line.lotKey);
      const quantity = Number(line.quantity);
      const unitPrice = Number(line.unitPrice);
      if (!lot || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) { setMessage('تمام خطوط فروش باید لات معتبر، مقدار مثبت و قیمت معتبر داشته باشند.'); return; }
      const packaged = lot.unitsCount > 0;
      const cumulative = (requestedByLot.get(lot.id) || 0) + quantity;
      requestedByLot.set(lot.id, cumulative);
      if (packaged && (!Number.isInteger(quantity) || cumulative > lot.unitsCount)) { setMessage(`تعداد تجمیعی بسته برای ${lot.batchCode} از موجودی همان لات بیشتر است.`); return; }
      if (!packaged && cumulative > lot.weightKg) { setMessage(`وزن تجمیعی برای ${lot.batchCode} از موجودی بیشتر است.`); return; }
      const origin = processingOrigin(lot, processingBatches);
      if (requiresProcessingOrigin(lot) && !origin) { setMessage(`ردیابی مبدأ برای لات ${lot.id} کامل نیست.`); return; }
      if (exportSale && lot.productType.includes('Caviar') && !origin?.citesPermitNumber?.trim()) { setMessage(`فروش صادراتی خاویار از لات ${lot.id} بدون CITES مسدود است.`); return; }
      items.push({ id: nextId('item'), productName: `${lot.productType} - ${lot.batchCode}`, sku: lotSku(lot), coldStorageLotId: lot.id, processingBatchId: origin?.id, quantity, unit: packaged ? lot.packagingUnit || 'piece' : 'kg', unitPrice, taxPercent: 0, discount: 0, total: Number((quantity * unitPrice).toFixed(2)) });
    }
    farm.createProformaInvoice({ invoiceNumber: nextReference(`PI-${new Date().getFullYear()}`), customerId: saleCustomer.id, customerName: saleCustomer.name, customerCompany: saleCustomer.companyName, customerCountry: saleCustomer.country, date: today, expiryDate: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10), stage: 'Proforma (پیش‌فاکتور)', items, taxTotal: 0, discountTotal: 0, currency, paymentTerms: paymentTerms.trim(), deliveryTerms: deliveryTerms.trim(), citesPermitRequired: exportSale && items.some((item) => item.sku.startsWith('CAV')), status: 'Sent' });
    farm.addCrmActivity({ customerId: saleCustomer.id, type: 'Message', subject: `صدور پیش‌فاکتور برای ${saleCustomer.name}`, details: `پیش‌فاکتور جدید با ${items.length} قلم فروش ثبت شد.`, outcome: 'Needs Follow-up', followUpAt: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 16), assignedTo: saleCustomer.ownerName, relatedProformaId: '', attachments: [] });
    setLines([{ id: nextId('draftline'), lotKey: '', quantity: '1', unitPrice: '0' }]);
    setShowProforma(false);
  };

  const changeStage = (proforma: ProformaInvoice, stage: ProformaInvoice['stage']) => {
    setMessage('');
    if (stage === 'Payment Received (تسویه)') { setMessage('تسویه مالی باید در گردش مالی/حسابداری ثبت شود؛ خروج فیزیکی فقط با تحویل انجام می‌شود.'); return; }
    farm.updateProformaStage(proforma.id, stage);
    farm.addCrmActivity({ customerId: proforma.customerId, type: 'Payment Follow-up', subject: `تغییر مرحله فروش: ${stage}`, details: `پیش‌فاکتور ${proforma.invoiceNumber} به مرحله ${stage} منتقل شد.`, outcome: stage.includes('Closed') ? 'Closed' : 'Needs Follow-up', followUpAt: stage.includes('Closed') ? undefined : new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 16), assignedTo: customers.find((row) => row.id === proforma.customerId)?.ownerName, relatedProformaId: proforma.id, attachments: [] });
  };

  const addCustomerSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!hasPermission('crm', 'create')) return;
    farm.addCustomer({ name: cust.name.trim(), companyName: cust.company.trim(), category: cust.category, phone: cust.phone.trim(), email: cust.email.trim(), country: cust.country.trim(), city: cust.city.trim(), address: '', currency: cust.currency, status: 'Lead', ownerName: cust.ownerName.trim(), tags: cust.tags.split(',').map((tag) => tag.trim()).filter(Boolean), score: Number(cust.score) || 0, notes: cust.notes.trim(), attachments: [] });
    setShowCustomer(false);
    setCust({ name: '', company: '', category: 'Export Luxury Distributor', phone: '', email: '', country: '', city: '', currency: 'IRR', ownerName: '', tags: '', score: '50', notes: '' });
  };

  const addActivitySubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    try {
      const attachments = await Promise.all(activityFiles.map((file) => uploadLocalAttachment('crm', file, activity.assignedTo)));
      const result = farm.addCrmActivity({ customerId: activity.customerId, type: activity.type, subject: activity.subject, details: activity.details, outcome: activity.outcome, followUpAt: activity.followUpAt || undefined, assignedTo: activity.assignedTo || undefined, relatedProformaId: activity.relatedProformaId || undefined, attachments });
      if (!result.success) { setMessage(result.error || 'ثبت پیگیری انجام نشد.'); return; }
      setShowActivity(false); setActivityFiles([]);
      setActivity({ customerId: activity.customerId, type: 'Call', subject: '', details: '', outcome: 'Needs Follow-up', followUpAt: '', assignedTo: '', relatedProformaId: '' });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'آپلود فایل CRM انجام نشد.');
    }
  };

  return <div className="space-y-5 pb-12 animate-fadeIn">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
      <div><h1 className="text-xl font-black text-white flex items-center gap-2"><Users className="w-6 h-6 text-emerald-400" />CRM 360، فروش و پیگیری مشتری</h1><p className="text-xs text-slate-400 mt-1">پرونده مشتری، فروش، پیگیری، یادآوری، فایل و عملکرد تیم در یک محیط متمرکز.</p></div>
      <div className="flex flex-wrap gap-2 text-xs">{(['dashboard', 'customers', 'sales', 'activities', 'reminders'] as Tab[]).map((id) => <button key={id} onClick={() => setTab(id)} className={`px-3 py-2 rounded-xl font-bold ${tab === id ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>{id === 'dashboard' ? 'داشبورد' : id === 'customers' ? 'مشتریان' : id === 'sales' ? 'فروش' : id === 'activities' ? 'پیگیری‌ها' : 'یادآوری‌ها'}</button>)}</div>
    </div>
    {message && <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{message}</div>}

    {tab === 'dashboard' && <div className="space-y-4">
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">{[
        ['مشتریان', customers.length, 'text-emerald-300'], ['فروش فعال', proformas.length, 'text-amber-300'], ['پیگیری‌ها', crmActivities.length, 'text-cyan-300'], ['یادآوری باز', openReminders.length, 'text-purple-300'], ['عقب‌افتاده', overdueReminders.length, 'text-rose-300'],
      ].map(([label, value, color]) => <div key={String(label)} className="bg-slate-900 border border-slate-800 rounded-2xl p-4"><span className="text-[11px] text-slate-500">{label}</span><strong className={`block text-2xl mt-1 ${color}`}>{formatNumber(Number(value))}</strong></div>)}</div>
      <div className="grid xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5"><h2 className="text-white font-bold mb-3">پرونده مشتری منتخب</h2>{selectedCustomer ? <CustomerCard customer={selectedCustomer} sales={customerSales(selectedCustomer.id)} activities={customerActivities(selectedCustomer.id)} reminders={customerReminders(selectedCustomer.id)} onSelect={() => setTab('customers')} formatCurrency={formatCurrency} /> : <Empty text="هنوز مشتری ثبت نشده است." />}</div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5"><h2 className="text-white font-bold mb-3">یادآوری‌های نزدیک</h2><div className="space-y-2">{openReminders.slice(0, 6).map((row) => <ReminderRow key={row.id} reminder={row} onDone={() => farm.updateCrmReminderStatus(row.id, 'Done')} />)}{!openReminders.length && <Empty text="یادآوری بازی وجود ندارد." />}</div></div>
      </div>
      <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs text-cyan-100">ارزش pipeline فعلی: {formatCurrency(totalPipeline, proformas[0]?.currency || 'IRR')}؛ برای چندارزی، جمع دقیق را در گزارش فروش/حسابداری ببینید.</div>
    </div>}

    {tab === 'customers' && <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-2 justify-between"><label className="relative flex-1"><Search className="w-4 h-4 absolute right-3 top-3 text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جستجو در مشتری، شرکت، تگ، کشور، مسئول..." className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 pr-9 text-xs text-white" /></label><button disabled={!hasPermission('crm', 'create')} onClick={() => setShowCustomer(true)} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"><Plus className="w-4 h-4 inline ml-1" />مشتری جدید</button></div>
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">{filteredCustomers.map((customer) => <button key={customer.id} onClick={() => { setSelectedCustomerId(customer.id); setTab('dashboard'); }} className="text-start"><CustomerCard customer={customer} sales={customerSales(customer.id)} activities={customerActivities(customer.id)} reminders={customerReminders(customer.id)} formatCurrency={formatCurrency} /></button>)}</div>
    </div>}

    {tab === 'sales' && <div className="space-y-4"><div className="flex justify-end"><button disabled={!hasPermission('sales', 'create') || sellableLots.length === 0} onClick={() => setShowProforma(true)} className="px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-bold disabled:opacity-40"><Plus className="w-4 h-4 inline ml-1" />پیش‌فاکتور از موجودی واقعی</button></div><div className="grid grid-cols-1 xl:grid-cols-2 gap-3">{proformas.map((proforma) => <div key={proforma.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5"><div className="flex justify-between gap-3 border-b border-slate-800 pb-3"><div><strong className="text-amber-400 font-mono">{proforma.invoiceNumber}</strong><p className="text-xs text-white mt-1">{proforma.customerName} · {proforma.customerCountry}</p></div><span className="text-[10px] text-slate-400">{proforma.stage}</span></div><div className="space-y-1 mt-3">{proforma.items.map((item) => <div key={item.id} className="flex justify-between text-xs"><span className="text-slate-300">{item.productName} · {formatNumber(item.quantity)} {item.unit}<span className="block text-[9px] text-slate-600 font-mono">Lot: {item.coldStorageLotId || 'legacy/unbound'}</span></span><strong className="text-amber-400">{formatCurrency(item.total, proforma.currency)}</strong></div>)}</div><div className="flex justify-between border-t border-slate-800 mt-3 pt-3"><strong className="text-white text-xs">جمع</strong><strong className="text-amber-400">{formatCurrency(proforma.grandTotal, proforma.currency)}</strong></div><div className="flex flex-wrap gap-2 mt-4"><select value={proforma.stage} disabled={!hasPermission('sales', 'edit') || Boolean(proforma.fulfilledAt)} onChange={(event) => changeStage(proforma, event.target.value as ProformaInvoice['stage'])} className="flex-1 bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white"><option value="Draft">پیش‌نویس</option><option value="Proforma (پیش‌فاکتور)">پیش‌فاکتور</option><option value="Order Confirmed (تایید سفارش)">سفارش قطعی</option><option value="Invoice Issued (صدور فاکتور)">صدور فاکتور</option><option value="Payment Received (تسویه)">تسویه</option><option value="Dispatched / Delivery (تحویل)">تحویل/ارسال</option><option value="Closed Won (موفق)">موفق</option><option value="Closed Lost (ناموفق)">ناموفق</option></select><button disabled={!hasPermission('sales', 'print')} onClick={() => setPrintProforma(proforma)} className="px-3 py-2 bg-slate-800 text-slate-200 rounded-lg"><Printer className="w-4 h-4" /></button></div></div>)}</div></div>}

    {tab === 'activities' && <div className="space-y-4"><div className="flex justify-end"><button disabled={!hasPermission('crm', 'create')} onClick={() => setShowActivity(true)} className="px-4 py-2 bg-cyan-600 text-white rounded-xl text-xs font-bold"><MessageSquare className="w-4 h-4 inline ml-1" />ثبت پیگیری</button></div><div className="space-y-2">{crmActivities.map((row) => <ActivityRow key={row.id} activity={row} />)}{!crmActivities.length && <Empty text="پیگیری ثبت نشده است." />}</div></div>}

    {tab === 'reminders' && <div className="space-y-2">{crmReminders.map((row) => <ReminderRow key={row.id} reminder={row} onDone={() => farm.updateCrmReminderStatus(row.id, 'Done')} />)}{!crmReminders.length && <Empty text="یادآوری ثبت نشده است." />}</div>}

    {showCustomer && <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"><div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 w-full max-w-2xl"><h2 className="text-white font-bold mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-emerald-400" />مشتری جدید در CRM 360</h2><form onSubmit={addCustomerSubmit} className="grid grid-cols-2 gap-3 text-xs"><input value={cust.name} onChange={(event) => setCust({ ...cust, name: event.target.value })} placeholder="نام" required className="field col-span-2" /><input value={cust.company} onChange={(event) => setCust({ ...cust, company: event.target.value })} placeholder="شرکت" required className="field col-span-2" /><input value={cust.country} onChange={(event) => setCust({ ...cust, country: event.target.value })} placeholder="کشور" required className="field" /><input value={cust.city} onChange={(event) => setCust({ ...cust, city: event.target.value })} placeholder="شهر" required className="field" /><input value={cust.phone} onChange={(event) => setCust({ ...cust, phone: event.target.value })} placeholder="تلفن" className="field" /><input type="email" value={cust.email} onChange={(event) => setCust({ ...cust, email: event.target.value })} placeholder="ایمیل" className="field" /><select value={cust.category} onChange={(event) => setCust({ ...cust, category: event.target.value as Customer['category'] })} className="field"><option>Export Luxury Distributor</option><option>5-Star Hotel / Restaurant</option><option>Domestic Gourmet Chain</option><option>Private VIP Client</option><option>Aquaculture Farm (Fingerlings)</option></select><select value={cust.currency} onChange={(event) => setCust({ ...cust, currency: event.target.value })} className="field"><option>IRR</option><option>USD</option><option>EUR</option><option>AED</option><option>RUB</option></select><input value={cust.ownerName} onChange={(event) => setCust({ ...cust, ownerName: event.target.value })} placeholder="مسئول مشتری" className="field" /><input type="number" min="0" max="100" value={cust.score} onChange={(event) => setCust({ ...cust, score: event.target.value })} placeholder="امتیاز مشتری" className="field" /><input value={cust.tags} onChange={(event) => setCust({ ...cust, tags: event.target.value })} placeholder="تگ‌ها با کاما: VIP, صادرات, هتل" className="field col-span-2" /><textarea value={cust.notes} onChange={(event) => setCust({ ...cust, notes: event.target.value })} placeholder="یادداشت پرونده مشتری" className="field col-span-2 min-h-20" /><div className="col-span-2 flex justify-end gap-2"><button type="button" onClick={() => setShowCustomer(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">انصراف</button><button type="submit" className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl">ثبت مشتری</button></div></form></div></div>}

    {showActivity && <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"><div className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-6 w-full max-w-2xl"><h2 className="text-white font-bold mb-4">ثبت تماس/پیگیری مشتری</h2><form onSubmit={addActivitySubmit} className="grid grid-cols-2 gap-3 text-xs"><select value={activity.customerId} onChange={(event) => setActivity({ ...activity, customerId: event.target.value })} className="field col-span-2">{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} - {customer.companyName}</option>)}</select><select value={activity.type} onChange={(event) => setActivity({ ...activity, type: event.target.value as CrmActivity['type'] })} className="field">{activityTypes.map((type) => <option key={type}>{type}</option>)}</select><select value={activity.outcome} onChange={(event) => setActivity({ ...activity, outcome: event.target.value as CrmActivity['outcome'] })} className="field">{activityOutcomes.map((outcome) => <option key={outcome}>{outcome}</option>)}</select><input value={activity.subject} onChange={(event) => setActivity({ ...activity, subject: event.target.value })} placeholder="موضوع پیگیری" required className="field col-span-2" /><textarea value={activity.details} onChange={(event) => setActivity({ ...activity, details: event.target.value })} placeholder="شرح مذاکره، درخواست، نتیجه یا مشکل" className="field col-span-2 min-h-24" /><input type="datetime-local" value={activity.followUpAt} onChange={(event) => setActivity({ ...activity, followUpAt: event.target.value })} className="field" /><input value={activity.assignedTo} onChange={(event) => setActivity({ ...activity, assignedTo: event.target.value })} placeholder="مسئول پیگیری" className="field" list="crm-employees" /><datalist id="crm-employees">{employees.map((employee) => <option key={employee.id} value={employee.fullName} />)}</datalist><select value={activity.relatedProformaId} onChange={(event) => setActivity({ ...activity, relatedProformaId: event.target.value })} className="field col-span-2"><option value="">بدون ارتباط با پیش‌فاکتور</option>{proformas.filter((row) => row.customerId === activity.customerId).map((row) => <option key={row.id} value={row.id}>{row.invoiceNumber} - {row.stage}</option>)}</select><label className="col-span-2 border border-dashed border-slate-700 rounded-xl p-4 text-slate-400 cursor-pointer"><FileUp className="w-4 h-4 inline ml-1" />پیوست فایل/عکس/رسید/قرارداد<input type="file" multiple onChange={(event) => setActivityFiles(Array.from(event.target.files || []))} className="hidden" /></label>{activityFiles.length > 0 && <div className="col-span-2 text-slate-400">{activityFiles.map((file) => `${file.name} (${sizeLabel(file.size)})`).join(' | ')}</div>}<div className="col-span-2 flex justify-end gap-2"><button type="button" onClick={() => setShowActivity(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">انصراف</button><button type="submit" className="px-4 py-2 bg-cyan-600 text-white font-bold rounded-xl">ثبت پیگیری</button></div></form></div></div>}

    {showProforma && <ProformaModal customers={customers} customerId={customerId} setCustomerId={setCustomerId} currency={currency} setCurrency={setCurrency} lines={lines} setLines={setLines} sellableLots={sellableLots} processingBatches={processingBatches} paymentTerms={paymentTerms} setPaymentTerms={setPaymentTerms} deliveryTerms={deliveryTerms} setDeliveryTerms={setDeliveryTerms} onClose={() => setShowProforma(false)} onSubmit={createSale} />}
    {printProforma && <PrintProforma proforma={printProforma} branding={branding} formatCurrency={formatCurrency} onClose={() => setPrintProforma(null)} />}
    <style>{`.field{background:#1e293b;border:1px solid #334155;border-radius:.75rem;padding:.625rem;color:white}`}</style>
  </div>;
};

const Empty: React.FC<{ text: string }> = ({ text }) => <div className="p-8 text-center text-xs text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl">{text}</div>;

const CustomerCard: React.FC<{ customer: Customer; sales: ProformaInvoice[]; activities: CrmActivity[]; reminders: CrmReminder[]; onSelect?: () => void; formatCurrency: (value: number, currency?: string) => string }> = ({ customer, sales, activities, reminders, onSelect, formatCurrency }) => {
  const open = reminders.filter((row) => row.status === 'Open').length;
  const sold = sales.reduce((sum, row) => sum + row.grandTotal, 0);
  return <div onClick={onSelect} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 h-full">
    <div className="flex justify-between border-b border-slate-800 pb-3"><div><strong className="text-white block">{customer.name}</strong><span className="text-amber-400 text-[10px]">{customer.category}</span></div><span className="text-[10px] text-slate-500">{customer.status}</span></div>
    <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-slate-300"><div className="flex gap-2"><Building className="w-4 h-4 text-slate-500" />{customer.companyName}</div><div className="flex gap-2"><Globe className="w-4 h-4 text-slate-500" />{customer.city}، {customer.country}</div><div className="flex gap-2"><Phone className="w-4 h-4 text-slate-500" />{customer.phone || '—'}</div><div className="flex gap-2"><Mail className="w-4 h-4 text-slate-500" />{customer.email || '—'}</div></div>
    <div className="flex flex-wrap gap-2 mt-3 text-[10px]">{(customer.tags || []).map((tag) => <span key={tag} className="px-2 py-1 rounded-lg bg-slate-800 text-cyan-200"><Tags className="w-3 h-3 inline ml-1" />{tag}</span>)}<span className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-200">امتیاز {customer.score ?? 0}</span><span className="px-2 py-1 rounded-lg bg-purple-500/10 text-purple-200">مسئول: {customer.ownerName || '—'}</span></div>
    <div className="grid grid-cols-3 gap-2 mt-4 text-center text-[11px]"><div className="bg-slate-950 rounded-xl p-2"><strong className="block text-amber-300">{sales.length}</strong>فروش</div><div className="bg-slate-950 rounded-xl p-2"><strong className="block text-cyan-300">{activities.length}</strong>پیگیری</div><div className="bg-slate-950 rounded-xl p-2"><strong className="block text-rose-300">{open}</strong>یادآوری باز</div></div>
    <div className="mt-3 text-[11px] text-slate-500">جمع فروش: {formatCurrency(sold, customer.currency)} · آخرین تماس: {customer.lastContactAt?.slice(0, 10) || '—'} · پیگیری بعدی: {customer.nextFollowUpAt?.slice(0, 10) || '—'}</div>
  </div>;
};

const ActivityRow: React.FC<{ activity: CrmActivity }> = ({ activity }) => <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs"><div className="flex flex-wrap justify-between gap-2"><div><strong className="text-white">{activity.subject}</strong><div className="text-slate-500 mt-1">{activity.customerName} · {activity.type} · {activity.outcome}</div></div><span className="text-slate-500">{activity.createdAt.slice(0, 16).replace('T', ' ')}</span></div><p className="text-slate-300 mt-2">{activity.details || '—'}</p><div className="flex flex-wrap gap-2 mt-2 text-[10px] text-slate-500"><span>مسئول: {activity.assignedTo || '—'}</span>{activity.followUpAt && <span>پیگیری بعدی: {activity.followUpAt.replace('T', ' ')}</span>}{activity.attachments.map((file) => <a key={file.id} href={file.downloadUrl} className="text-cyan-300" target="_blank" rel="noreferrer">{file.fileName}</a>)}</div></div>;

const ReminderRow: React.FC<{ reminder: CrmReminder; onDone: () => void }> = ({ reminder, onDone }) => <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs flex items-center justify-between gap-3"><div><strong className="text-white flex items-center gap-2"><Bell className="w-4 h-4 text-amber-300" />{reminder.title}</strong><div className="text-slate-500 mt-1">{reminder.customerName} · {reminder.dueAt.replace('T', ' ')} · {reminder.priority} · {reminder.assignedTo || 'بدون مسئول'}</div></div>{reminder.status === 'Open' ? <button onClick={onDone} className="px-3 py-2 rounded-xl bg-emerald-600 text-white font-bold"><CheckCircle2 className="w-4 h-4 inline ml-1" />انجام شد</button> : <span className="text-emerald-300">{reminder.status}</span>}</div>;

const ProformaModal: React.FC<any> = ({ customers, customerId, setCustomerId, currency, setCurrency, lines, setLines, sellableLots, processingBatches, paymentTerms, setPaymentTerms, deliveryTerms, setDeliveryTerms, onClose, onSubmit }) => <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"><div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-6 w-full max-w-4xl max-h-[92vh] overflow-auto"><h2 className="text-white font-bold mb-4">پیش‌فاکتور مبتنی بر لات سردخانه</h2><form onSubmit={onSubmit} className="space-y-4 text-xs"><div className="grid md:grid-cols-2 gap-3"><select value={customerId} onChange={(event) => setCustomerId(event.target.value)} className="field" required><option value="">انتخاب مشتری...</option>{customers.map((customer: Customer) => <option key={customer.id} value={customer.id}>{customer.name} - {customer.country}</option>)}</select><select value={currency} onChange={(event) => setCurrency(event.target.value)} className="field"><option>IRR</option><option>USD</option><option>EUR</option><option>AED</option><option>RUB</option></select></div>{lines.map((line: DraftLine) => { const lot = sellableLots.find((row: ColdStoragePallet) => row.id === line.lotKey); const origin = lot ? processingOrigin(lot, processingBatches) : undefined; return <div key={line.id} className="grid grid-cols-12 gap-2 items-end bg-slate-900 border border-slate-800 rounded-xl p-3"><select value={line.lotKey} onChange={(event) => setLines((previous: DraftLine[]) => previous.map((item) => item.id === line.id ? { ...item, lotKey: event.target.value } : item))} className="field col-span-12 md:col-span-6" required><option value="">انتخاب لات...</option>{sellableLots.map((candidate: ColdStoragePallet) => <option key={candidate.id} value={candidate.id}>{candidate.productType} · {candidate.batchCode} · {lotSku(candidate)}</option>)}</select><input type="number" min="0.001" step={lot?.unitsCount ? '1' : '0.001'} value={line.quantity} onChange={(event) => setLines((previous: DraftLine[]) => previous.map((item) => item.id === line.id ? { ...item, quantity: event.target.value } : item))} className="field col-span-5 md:col-span-2" /><input type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => setLines((previous: DraftLine[]) => previous.map((item) => item.id === line.id ? { ...item, unitPrice: event.target.value } : item))} className="field col-span-5 md:col-span-3" /><button type="button" disabled={lines.length <= 1} onClick={() => setLines((previous: DraftLine[]) => previous.filter((item) => item.id !== line.id))} className="col-span-2 md:col-span-1 p-2 text-rose-400 disabled:opacity-30"><Trash2 className="w-4 h-4" /></button>{lot && <div className="col-span-12 text-[10px] text-slate-500">Lot ID: {lot.id} · Processing: {origin?.id || 'ردیابی ناقص'} · CITES: {origin?.citesPermitNumber || 'ثبت نشده'}</div>}</div>; })}<button type="button" onClick={() => setLines((previous: DraftLine[]) => [...previous, { id: nextId('draftline'), lotKey: '', quantity: '1', unitPrice: '0' }])} className="px-3 py-2 bg-slate-800 text-slate-300 rounded-lg">+ قلم دیگر</button><div className="grid md:grid-cols-2 gap-3"><input value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value)} placeholder="شرایط پرداخت" className="field" /><input value={deliveryTerms} onChange={(event) => setDeliveryTerms(event.target.value)} placeholder="شرایط تحویل / Incoterm" className="field" /></div><div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl">انصراف</button><button type="submit" className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl">صدور پیش‌فاکتور</button></div></form></div></div>;

const PrintProforma: React.FC<{ proforma: ProformaInvoice; branding: any; formatCurrency: (value: number, currency?: string) => string; onClose: () => void }> = ({ proforma, branding, formatCurrency, onClose }) => <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"><div className="bg-white text-slate-900 rounded-2xl p-8 w-full max-w-3xl max-h-[90vh] overflow-auto"><div className="flex justify-between border-b pb-4"><div><h2 className="text-xl font-black">{branding?.companyNameEn || 'Fathi Aqua'} - Proforma Invoice</h2><div className="text-sm font-bold">{branding?.companyNameFa}</div></div><button onClick={onClose} className="text-slate-500">×</button></div><div className="grid grid-cols-2 gap-3 mt-4 text-sm"><div>Invoice No: <strong className="font-mono">{proforma.invoiceNumber}</strong></div><div>Date: {proforma.date}</div><div className="col-span-2">Customer: <strong>{proforma.customerName}</strong> · {proforma.customerCompany} · {proforma.customerCountry}</div></div><table className="w-full text-sm mt-4"><thead><tr className="border-b"><th className="text-left p-2">Product</th><th className="p-2">Qty</th><th className="p-2">Total</th></tr></thead><tbody>{proforma.items.map((item) => <tr key={item.id} className="border-b"><td className="p-2">{item.productName}<div className="text-xs font-mono">{item.sku}</div></td><td className="p-2 text-center">{item.quantity} {item.unit}</td><td className="p-2 text-center">{formatCurrency(item.total, proforma.currency)}</td></tr>)}</tbody></table><div className="mt-4 text-right font-black">Grand Total: {formatCurrency(proforma.grandTotal, proforma.currency)}</div><div className="mt-6 flex justify-end gap-2 print:hidden"><button onClick={() => window.print()} className="px-4 py-2 bg-slate-900 text-white rounded-lg">Print</button><button onClick={onClose} className="px-4 py-2 bg-slate-200 rounded-lg">Close</button></div></div></div>;
