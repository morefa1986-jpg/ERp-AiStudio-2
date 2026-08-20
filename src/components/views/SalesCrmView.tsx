import React, { useMemo, useState } from 'react';
import { Plus, Receipt, Users } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useFarm } from '../../context/FarmContext';
import { runtimeValueLabel } from '../../i18n/runtimeMessages';
import { Customer, ProformaInvoice } from '../../types';

export const SalesCrmView: React.FC = () => {
  const { t, formatNumber, formatCurrency, formatDate, language } = useI18n();
  const { customers, proformas, addCustomer, createProformaInvoice } = useFarm();
  const [tab, setTab] = useState<'customers' | 'proformas'>('customers');
  const [customerModal, setCustomerModal] = useState(false);
  const [proformaModal, setProformaModal] = useState(false);
  const [customer, setCustomer] = useState({ name: '', companyName: '', category: 'Export Luxury Distributor' as Customer['category'], phone: '', email: '', country: '', city: '', currency: 'EUR' });
  const [proforma, setProforma] = useState({ customerId: customers[0]?.id || '', currency: 'EUR' as ProformaInvoice['currency'], productName: '', sku: '', quantity: 0, unitPrice: 0, paymentTerms: '', deliveryTerms: '' });

  const selectedCustomer = customers.find((item) => item.id === proforma.customerId);
  const totalSales = useMemo(() => proformas.filter((item) => ['Accepted', 'Converted to Invoice'].includes(item.status)).reduce((sum, item) => sum + item.grandTotal, 0), [proformas]);
  const activeCustomers = customers.filter((item) => item.status !== 'Inactive').length;
  const pending = proformas.filter((item) => !['Converted to Invoice', 'Cancelled'].includes(item.status)).length;
  const stageLabel = (value: string) => language === 'fa' ? (value.match(/\((.*)\)/)?.[1] || value.split(' (')[0]) : value.split(' (')[0];

  const saveCustomer = (event: React.FormEvent) => {
    event.preventDefault();
    addCustomer({ ...customer, address: '', outstandingBalance: 0, totalOrdersCount: 0, totalSpent: 0, status: 'Lead', notes: '' } as any);
    setCustomerModal(false);
    setCustomer({ name: '', companyName: '', category: 'Export Luxury Distributor', phone: '', email: '', country: '', city: '', currency: 'EUR' });
  };

  const saveProforma = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedCustomer || !proforma.productName.trim() || proforma.quantity <= 0 || proforma.unitPrice < 0) return;
    const lineTotal = proforma.quantity * proforma.unitPrice;
    const now = new Date();
    const expiry = new Date(now.getTime() + 7 * 86_400_000);
    const existingStage = proformas.find((item) => String(item.stage).toLowerCase().startsWith('proforma'))?.stage;
    createProformaInvoice({
      invoiceNumber: `PF-${Date.now()}`,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      customerCompany: selectedCustomer.companyName,
      customerCountry: selectedCustomer.country,
      date: now.toISOString().slice(0, 10),
      expiryDate: expiry.toISOString().slice(0, 10),
      stage: (existingStage || 'Proforma') as ProformaInvoice['stage'],
      items: [{ id: `item_${Date.now()}`, productName: proforma.productName.trim(), sku: proforma.sku.trim(), quantity: proforma.quantity, unit: 'kg', unitPrice: proforma.unitPrice, taxPercent: 0, discount: 0, total: lineTotal }],
      taxTotal: 0,
      discountTotal: 0,
      currency: proforma.currency,
      paymentTerms: proforma.paymentTerms.trim(),
      deliveryTerms: proforma.deliveryTerms.trim(),
      citesPermitRequired: false,
      status: 'Draft',
    });
    setProformaModal(false);
    setProforma((previous) => ({ ...previous, productName: '', sku: '', quantity: 0, unitPrice: 0, paymentTerms: '', deliveryTerms: '' }));
  };

  return <div className="space-y-6 animate-fadeIn pb-12">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"><div><h1 className="text-xl font-black text-white flex items-center gap-2.5"><Users className="w-6 h-6 text-amber-400" />{t('salesCrm.title')}</h1><p className="text-xs text-slate-400 mt-1">{t('salesCrm.subtitle')}</p></div><div className="flex gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs"><button onClick={() => setTab('customers')} className={`px-4 py-1.5 rounded-lg ${tab === 'customers' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'}`}>{t('salesCrm.tabCustomers')} ({formatNumber(customers.length)})</button><button onClick={() => setTab('proformas')} className={`px-4 py-1.5 rounded-lg ${tab === 'proformas' ? 'bg-blue-500 text-slate-950 font-bold' : 'text-slate-400'}`}>{t('salesCrm.tabProformas')} ({formatNumber(proformas.length)})</button></div></div>

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4"><Metric title={t('salesCrm.cardTotalSales')} value={formatCurrency(totalSales, proformas[0]?.currency || 'IRR')} /><Metric title={t('salesCrm.cardPendingProformas')} value={formatNumber(pending)} /><Metric title={t('salesCrm.cardActiveCustomers')} value={formatNumber(activeCustomers)} /></div>

    {tab === 'customers' ? <div className="space-y-4"><div className="flex justify-end"><button onClick={() => setCustomerModal(true)} className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs flex gap-1"><Plus className="w-4 h-4" />{t('salesCrm.btnNewCustomer')}</button></div><div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto"><table className="w-full text-xs text-start"><thead className="bg-slate-800 text-slate-400"><tr><th className="p-3">{t('salesCrm.customerName')}</th><th className="p-3">{t('salesCrm.country')}</th><th className="p-3">{t('salesCrm.contact')}</th><th className="p-3">{t('salesCrm.totalOrders')}</th><th className="p-3">{t('status')}</th></tr></thead><tbody className="divide-y divide-slate-800">{customers.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-slate-500">{t('noData')}</td></tr> : customers.map((item) => <tr key={item.id} className="text-slate-300"><td className="p-3"><strong className="text-white block">{item.name}</strong><span>{item.companyName}</span></td><td className="p-3">{item.city}, {item.country}</td><td className="p-3"><span className="block">{item.phone}</span><span>{item.email}</span></td><td className="p-3">{formatNumber(item.totalOrdersCount)}</td><td className="p-3">{runtimeValueLabel(language, item.status)}</td></tr>)}</tbody></table></div></div> : <div className="space-y-4"><div className="flex justify-end"><button onClick={() => { if (!proforma.customerId && customers[0]) setProforma((p) => ({ ...p, customerId: customers[0].id })); setProformaModal(true); }} disabled={!customers.length} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl text-xs flex gap-1 disabled:opacity-40"><Receipt className="w-4 h-4" />{t('salesCrm.btnNewProforma')}</button></div><div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto"><table className="w-full text-xs text-start"><thead className="bg-slate-800 text-slate-400"><tr><th className="p-3">{t('salesCrm.thInvoiceNo')}</th><th className="p-3">{t('salesCrm.thCustomer')}</th><th className="p-3">{t('salesCrm.thDate')}</th><th className="p-3">{t('salesCrm.thAmount')}</th><th className="p-3">{t('salesCrm.thStage')}</th><th className="p-3">{t('status')}</th></tr></thead><tbody className="divide-y divide-slate-800">{proformas.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-slate-500">{t('noData')}</td></tr> : proformas.map((item) => <tr key={item.id} className="text-slate-300"><td className="p-3 font-mono text-blue-300">{item.invoiceNumber}</td><td className="p-3 text-white">{item.customerName}</td><td className="p-3">{formatDate(item.date)}</td><td className="p-3 font-bold">{formatCurrency(item.grandTotal, item.currency)}</td><td className="p-3">{stageLabel(String(item.stage))}</td><td className="p-3">{runtimeValueLabel(language, item.status)}</td></tr>)}</tbody></table></div></div>}

    {customerModal && <Modal title={t('salesCrm.modalCustomerTitle')} close={() => setCustomerModal(false)}><form onSubmit={saveCustomer} className="space-y-3 text-xs"><Text label={t('salesCrm.fieldCustName')} value={customer.name} set={(value) => setCustomer((p) => ({ ...p, name: value }))} /><Text label={t('salesCrm.fieldCustCompany')} value={customer.companyName} set={(value) => setCustomer((p) => ({ ...p, companyName: value }))} /><div className="grid grid-cols-2 gap-2"><Text label={t('salesCrm.fieldCustPhone')} value={customer.phone} set={(value) => setCustomer((p) => ({ ...p, phone: value }))} /><Text label={t('salesCrm.fieldCustEmail')} value={customer.email} set={(value) => setCustomer((p) => ({ ...p, email: value }))} /></div><div className="grid grid-cols-2 gap-2"><Text label={t('salesCrm.fieldCustCountry')} value={customer.country} set={(value) => setCustomer((p) => ({ ...p, country: value }))} /><Text label={t('salesCrm.fieldCustCity')} value={customer.city} set={(value) => setCustomer((p) => ({ ...p, city: value }))} /></div><label className="text-slate-300">{t('salesCrm.fieldCustCurrency')}<select value={customer.currency} onChange={(e) => setCustomer((p) => ({ ...p, currency: e.target.value }))} className="mt-1 w-full field"><option>IRR</option><option>EUR</option><option>USD</option><option>RUB</option><option>AED</option></select></label><Actions cancel={() => setCustomerModal(false)} submit={t('salesCrm.btnSaveCustomer')} t={t} /></form></Modal>}

    {proformaModal && <Modal title={t('salesCrm.modalProformaTitle')} close={() => setProformaModal(false)}><form onSubmit={saveProforma} className="space-y-3 text-xs"><label className="text-slate-300">{t('salesCrm.fieldProfCustomer')}<select value={proforma.customerId} onChange={(e) => setProforma((p) => ({ ...p, customerId: e.target.value }))} className="mt-1 w-full field">{customers.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.companyName}</option>)}</select></label><Text label={t('salesCrm.fieldProfItem')} value={proforma.productName} set={(value) => setProforma((p) => ({ ...p, productName: value }))} /><Text label="SKU" value={proforma.sku} set={(value) => setProforma((p) => ({ ...p, sku: value }))} /><div className="grid grid-cols-2 gap-2"><NumberInput label={t('salesCrm.fieldProfQty')} value={proforma.quantity} set={(value) => setProforma((p) => ({ ...p, quantity: value }))} /><NumberInput label={t('salesCrm.fieldProfPrice')} value={proforma.unitPrice} set={(value) => setProforma((p) => ({ ...p, unitPrice: value }))} /></div><Text label={t('salesCrm.fieldProfPayment')} value={proforma.paymentTerms} set={(value) => setProforma((p) => ({ ...p, paymentTerms: value }))} /><Text label={t('salesCrm.fieldProfDelivery')} value={proforma.deliveryTerms} set={(value) => setProforma((p) => ({ ...p, deliveryTerms: value }))} /><Actions cancel={() => setProformaModal(false)} submit={t('salesCrm.btnIssueProforma')} t={t} /></form></Modal>}
    <style>{`.field{background:#1e293b;border:1px solid #334155;border-radius:.7rem;padding:.6rem;color:white}`}</style>
  </div>;
};

const Metric: React.FC<{ title: string; value: string }> = ({ title, value }) => <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4"><span className="text-xs text-slate-400 block">{title}</span><strong className="text-xl text-white block mt-1">{value}</strong></div>;
const Modal: React.FC<{ title: string; close: () => void; children: React.ReactNode }> = ({ title, close, children }) => <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4"><div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-5 space-y-4"><div className="flex justify-between"><h3 className="font-bold text-white">{title}</h3><button type="button" onClick={close} className="text-slate-400">×</button></div>{children}</div></div>;
const Text: React.FC<{ label: string; value: string; set: (value: string) => void }> = ({ label, value, set }) => <label className="block text-slate-300">{label}<input value={value} onChange={(e) => set(e.target.value)} className="mt-1 w-full field" required /></label>;
const NumberInput: React.FC<{ label: string; value: number; set: (value: number) => void }> = ({ label, value, set }) => <label className="block text-slate-300">{label}<input type="number" min="0" step="0.01" value={value || ''} onChange={(e) => set(Number(e.target.value))} className="mt-1 w-full field" required /></label>;
const Actions: React.FC<{ cancel: () => void; submit: string; t: (key: string) => string }> = ({ cancel, submit, t }) => <div className="flex justify-end gap-2"><button type="button" onClick={cancel} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg">{t('cancel')}</button><button type="submit" className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-lg">{submit}</button></div>;
