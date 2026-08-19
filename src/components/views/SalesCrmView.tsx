import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { useFarm } from '../../context/FarmContext';
import {
  Users,
  Receipt,
  Plus,
  Search,
  DollarSign,
  Printer,
  FileText,
  ShieldCheck,
  Globe,
  Mail,
  Phone,
  Building,
} from 'lucide-react';
import { Customer, ProformaInvoice } from '../../types';

export const SalesCrmView: React.FC = () => {
  const { t, formatNumber, formatCurrency, formatDate } = useI18n();
  const {
    customers,
    proformas,
    addCustomer,
    createProformaInvoice,
    updateProformaStage,
  } = useFarm();

  const [activeTab, setActiveTab] = useState<'proformas' | 'customers'>('proformas');
  const [showNewCustomerModal, setShowNewCustomerModal] = useState<boolean>(false);
  const [showNewProformaModal, setShowNewProformaModal] = useState<boolean>(false);
  const [printProforma, setPrintProforma] = useState<ProformaInvoice | null>(null);

  // New Customer Form state
  const [newCustName, setNewCustName] = useState<string>('');
  const [newCustCompany, setNewCustCompany] = useState<string>('');
  const [newCustCategory, setNewCustCategory] = useState<Customer['category']>('Export Luxury Distributor');
  const [newCustPhone, setNewCustPhone] = useState<string>('');
  const [newCustEmail, setNewCustEmail] = useState<string>('');
  const [newCustCountry, setNewCustCountry] = useState<string>('UAE');
  const [newCustCity, setNewCustCity] = useState<string>('Dubai');
  const [newCustCurrency, setNewCustCurrency] = useState<string>('USD');

  // New Proforma Form state
  const [profCustId, setProfCustId] = useState<string>(customers[0]?.id || '');
  const [profCurrency, setProfCurrency] = useState<string>('USD');
  const [profItemName, setProfItemName] = useState<string>('خاویار امپریال بلوگا فتحی (قوطی ۵۰ گرمی)');
  const [profItemQty, setProfItemQty] = useState<number>(200);
  const [profItemPrice, setProfItemPrice] = useState<number>(110);
  const [profPaymentTerms, setProfPaymentTerms] = useState<string>('50% Advance T/T, 50% Before Airport Dispatch');
  const [profDeliveryTerms, setProfDeliveryTerms] = useState<string>('CIF Dubai Airport with CITES Certificate');

  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    addCustomer({
      name: newCustName,
      companyName: newCustCompany,
      category: newCustCategory,
      phone: newCustPhone,
      email: newCustEmail,
      country: newCustCountry,
      city: newCustCity,
      address: 'دفتر مرکزی / انبار تحویل',
      currency: profCurrency,
      status: 'Active VIP',
      notes: 'مشتری مستقیم بین‌المللی',
    });
    setShowNewCustomerModal(false);
    setNewCustName('');
    setNewCustCompany('');
  };

  const handleCreateProforma = (e: React.FormEvent) => {
    e.preventDefault();
    const cust = customers.find((c) => c.id === profCustId);
    if (!cust) return;

    const itemTotal = profItemQty * profItemPrice;

    createProformaInvoice({
      invoiceNumber: `PI-${new Date().getFullYear()}-EXP-${Math.floor(100 + Math.random() * 900)}`,
      customerId: cust.id,
      customerName: cust.name,
      customerCompany: cust.companyName,
      customerCountry: cust.country,
      date: new Date().toISOString().split('T')[0],
      expiryDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
      stage: 'Proforma (پیش‌فاکتور)',
      items: [
        {
          id: 'item_' + Date.now(),
          productName: profItemName,
          sku: 'CAV-BEL-50G',
          quantity: profItemQty,
          unit: 'قوطی',
          unitPrice: profItemPrice,
          taxPercent: 0,
          discount: 0,
          total: itemTotal,
        },
      ],
      taxTotal: 0,
      discountTotal: 0,
      currency: profCurrency,
      paymentTerms: profPaymentTerms,
      deliveryTerms: profDeliveryTerms,
      citesPermitRequired: true,
      status: 'Sent',
    });

    setShowNewProformaModal(false);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2.5">
            <DollarSign className="w-6 h-6 text-amber-400" />
            بازرگانی، CRM 360 و پیش‌فاکتورهای ارزی صادراتی
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            مدیریت مشتریان VIP، صدور پروفرما به دلار، یورو و ریال، شرایط CITES، اینکوترمز و قراردادها
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('proformas')}
            className={`px-4 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'proformas'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            پیش‌فاکتورها و فروش ({proformas.length})
          </button>
          <button
            onClick={() => setActiveTab('customers')}
            className={`px-4 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'customers'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            باشگاه مشتریان CRM ({customers.length})
          </button>
        </div>
      </div>

      {/* TAB 1: Proforma Invoices */}
      {activeTab === 'proformas' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowNewProformaModal(true)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/20"
            >
              <Plus className="w-4 h-4" />
              صدور پیش‌فاکتور جدید (ارزی / ریالی)
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {proformas.map((prof) => (
              <div
                key={prof.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <span className="font-mono font-black text-amber-400 text-sm">
                      {prof.invoiceNumber}
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      تاریخ: {prof.date} | انقضا: {prof.expiryDate}
                    </span>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                      prof.stage === 'Proforma (پیش‌فاکتور)'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    }`}
                  >
                    {prof.stage}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-slate-400">خریدار:</span>{' '}
                    <strong className="text-white">{prof.customerName}</strong> ({prof.customerCompany})
                  </div>
                  <div>
                    <span className="text-slate-400">کشور مقصد:</span>{' '}
                    <strong className="text-slate-200">{prof.customerCountry}</strong>
                  </div>

                  {/* Items */}
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 space-y-1.5">
                    {prof.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-slate-300 text-xs">
                        <span>
                          {item.productName} ({formatNumber(item.quantity)} {item.unit})
                        </span>
                        <strong className="text-amber-400">
                          {formatCurrency(item.total, prof.currency)}
                        </strong>
                      </div>
                    ))}
                    <div className="border-t border-slate-800 pt-1.5 flex justify-between font-black text-white text-sm">
                      <span>جمع کل پیش‌فاکتور:</span>
                      <span className="text-amber-400">
                        {formatCurrency(prof.grandTotal, prof.currency)}
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 space-y-0.5">
                    <div>شرایط پرداخت: {prof.paymentTerms}</div>
                    <div>تحویل: {prof.deliveryTerms}</div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex justify-between items-center pt-2 border-t border-slate-800 gap-2">
                  <select
                    value={prof.stage}
                    onChange={(e) => updateProformaStage(prof.id, e.target.value as any)}
                    className="bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs"
                  >
                    <option value="Draft">پیش‌نویس</option>
                    <option value="Proforma (پیش‌فاکتور)">Proforma (پیش‌فاکتور)</option>
                    <option value="Confirmed Order">سفارش قطعی شده</option>
                    <option value="Final Commercial Invoice">فاکتور تجاری نهایی</option>
                    <option value="Paid">تسویه کامل شده</option>
                  </select>

                  <button
                    onClick={() => setPrintProforma(prof)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer border border-slate-700"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    چاپ / پیش‌نمایش رسمی
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: CRM Customer Directory */}
      {activeTab === 'customers' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowNewCustomerModal(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-600/20"
            >
              <Plus className="w-4 h-4" />
              افزودن خریدار جدید
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {customers.map((cust) => (
              <div
                key={cust.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h3 className="font-bold text-sm text-white">{cust.name}</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {cust.category}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    <span>{cust.companyName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                    <span>{cust.city}، {cust.country}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-mono">{cust.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-mono text-[11px]">{cust.email}</span>
                  </div>
                </div>

                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex justify-between text-xs">
                  <span className="text-slate-400">مجموع خرید:</span>
                  <strong className="text-amber-400">
                    {formatCurrency(cust.totalSpent, cust.currency)}
                  </strong>
                </div>

                <p className="text-[11px] text-slate-400 line-clamp-2">
                  {cust.notes}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Printable Invoice Modal */}
      {printProforma && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-950 border border-amber-500/40 rounded-2xl max-w-2xl w-full p-8 shadow-2xl space-y-6 text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-black text-amber-400">
                  FATHI STURGEON & CAVIAR CO.
                </h2>
                <p className="text-xs text-slate-400">
                  Official Export Proforma Invoice (CITES Registered)
                </p>
              </div>

              <div className="text-right font-mono text-xs">
                <div className="font-bold text-white">{printProforma.invoiceNumber}</div>
                <div className="text-slate-400">{printProforma.date}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-900/60 p-4 rounded-xl border border-slate-800">
              <div>
                <span className="text-slate-400 block">Buyer / Consignee:</span>
                <strong className="text-white text-sm">{printProforma.customerName}</strong>
                <div className="text-slate-300">{printProforma.customerCompany}</div>
                <div className="text-slate-400">{printProforma.customerCountry}</div>
              </div>
              <div>
                <span className="text-slate-400 block">Commercial Terms:</span>
                <div>Currency: <strong className="text-amber-400">{printProforma.currency}</strong></div>
                <div>Payment: <span className="text-slate-300">{printProforma.paymentTerms}</span></div>
                <div>Delivery: <span className="text-slate-300">{printProforma.deliveryTerms}</span></div>
              </div>
            </div>

            <table className="w-full text-xs text-right">
              <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-2.5">Description</th>
                  <th className="p-2.5">Quantity</th>
                  <th className="p-2.5">Unit Price</th>
                  <th className="p-2.5">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {printProforma.items.map((it) => (
                  <tr key={it.id}>
                    <td className="p-2.5 font-bold text-white">{it.productName}</td>
                    <td className="p-2.5">{it.quantity} {it.unit}</td>
                    <td className="p-2.5 font-mono">{formatCurrency(it.unitPrice, printProforma.currency)}</td>
                    <td className="p-2.5 font-bold text-amber-400 font-mono">
                      {formatCurrency(it.total, printProforma.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-slate-800 pt-3 flex justify-between items-center text-sm font-black">
              <span>Grand Total:</span>
              <span className="text-amber-400 font-mono text-base">
                {formatCurrency(printProforma.grandTotal, printProforma.currency)}
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setPrintProforma(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs cursor-pointer"
              >
                بستن
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                چاپ فاکتور رسمی
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Proforma Modal */}
      {showNewProformaModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-amber-400" />
              صدور پیش‌فاکتور جدید
            </h3>

            <form onSubmit={handleCreateProforma} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">مشتری:</label>
                <select
                  value={profCustId}
                  onChange={(e) => setProfCustId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.companyName} ({c.country})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">ارز فاکتور:</label>
                  <select
                    value={profCurrency}
                    onChange={(e) => setProfCurrency(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-bold"
                  >
                    <option value="USD">دلار آمریکا (USD $)</option>
                    <option value="EUR">یورو اروپا (EUR €)</option>
                    <option value="IRR">تومان ایران (IRR)</option>
                    <option value="AED">درهم امارات (AED)</option>
                    <option value="RUB">روبل روسیه (RUB)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">تعداد قوطی / بسته:</label>
                  <input
                    type="number"
                    min="1"
                    value={profItemQty}
                    onChange={(e) => setProfItemQty(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">قیمت واحد ({profCurrency}):</label>
                <input
                  type="number"
                  step="0.01"
                  value={profItemPrice}
                  onChange={(e) => setProfItemPrice(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-bold text-amber-400"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewProformaModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl cursor-pointer"
                >
                  صدور پیش‌فاکتور
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
