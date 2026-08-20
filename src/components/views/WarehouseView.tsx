import React, { useMemo, useState } from 'react';
import { AlertTriangle, Package, Plus, Search } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useFarm } from '../../context/FarmContext';
import { useAuth } from '../../context/AuthContext';
import { runtimeUnitLabel, runtimeValueLabel } from '../../i18n/runtimeMessages';
import { domainLabel } from '../../i18n/runtimeDomainLabels';
import { InventoryTxType } from '../../types';

export const WarehouseView: React.FC = () => {
  const { t, formatNumber, formatCurrency, language } = useI18n();
  const { currentUser } = useAuth();
  const { inventory, inventoryTxs, addInventoryTransaction } = useFarm();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [itemId, setItemId] = useState(inventory[0]?.id || '');
  const [txType, setTxType] = useState<'Purchase' | 'Consumption' | 'Adjustment'>('Purchase');
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState('');

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return inventory.filter((item) => !query || item.name.toLowerCase().includes(query) || item.sku.toLowerCase().includes(query) || item.category.toLowerCase().includes(query));
  }, [inventory, search]);
  const totalValue = inventory.reduce((sum, item) => sum + item.quantity * item.purchasePricePerUnit, 0);
  const lowStock = inventory.filter((item) => item.status === 'Low Stock' || item.status === 'Critical Low').length;
  const selected = inventory.find((item) => item.id === itemId);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !Number.isFinite(amount) || amount <= 0) return;
    const sign = txType === 'Consumption' ? -1 : 1;
    addInventoryTransaction({ itemId: selected.id, itemName: selected.name, sku: selected.sku, type: txType as InventoryTxType, quantityChange: sign * amount, unit: selected.unit, unitPrice: selected.purchasePricePerUnit, totalValue: amount * selected.purchasePricePerUnit, referenceDoc: reason.trim() || undefined, operator: currentUser?.fullName || 'Local Operator', notes: '' });
    setShowModal(false); setAmount(0); setReason('');
  };

  return <div className="space-y-6 animate-fadeIn pb-12">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"><div><h1 className="text-xl font-black text-white flex items-center gap-2.5"><Package className="w-6 h-6 text-amber-400" />{t('warehouse.title')}</h1><p className="text-xs text-slate-400 mt-1">{t('warehouse.subtitle')}</p></div><button onClick={() => setShowModal(true)} disabled={!inventory.length} className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs flex gap-1 disabled:opacity-40"><Plus className="w-4 h-4" />{t('warehouse.btnNewMovement')}</button></div>

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4"><Metric title={t('warehouse.cardTotalValue')} value={formatCurrency(totalValue, inventory[0]?.currency || 'IRR')} /><Metric title={t('warehouse.cardTotalItems')} value={formatNumber(inventory.length)} /><Metric title={t('warehouse.cardLowStock')} value={formatNumber(lowStock)} alert={lowStock > 0} /></div>

    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4"><div className="relative max-w-md"><Search className="w-4 h-4 absolute start-3 top-2.5 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('warehouse.searchPlaceholder')} className="w-full bg-slate-800 border border-slate-700 rounded-xl ps-9 pe-3 py-2 text-xs text-white" /></div></div>

    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto"><table className="w-full text-xs text-start"><thead className="bg-slate-800 text-slate-400"><tr><th className="p-3">{t('warehouse.thSku')}</th><th className="p-3">{t('warehouse.thItemName')}</th><th className="p-3">{t('warehouse.thCategory')}</th><th className="p-3">{t('warehouse.thQuantity')}</th><th className="p-3">{t('warehouse.thReorder')}</th><th className="p-3">{t('warehouse.thPrice')}</th><th className="p-3">{t('warehouse.thStatus')}</th></tr></thead><tbody className="divide-y divide-slate-800">{visible.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-slate-500">{t('noData')}</td></tr> : visible.map((item) => <tr key={item.id} className="text-slate-300"><td className="p-3 font-mono text-amber-400">{item.sku}</td><td className="p-3 text-white font-bold">{item.name}</td><td className="p-3">{domainLabel(language, item.category)}</td><td className="p-3">{formatNumber(item.quantity)} {runtimeUnitLabel(language, item.unit)}</td><td className="p-3">{formatNumber(item.reorderLevel)}</td><td className="p-3">{formatCurrency(item.purchasePricePerUnit, item.currency)}</td><td className="p-3">{runtimeValueLabel(language, item.status)}</td></tr>)}</tbody></table></div>

    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto"><table className="w-full text-xs text-start"><thead className="bg-slate-800 text-slate-400"><tr><th className="p-3">{t('date')}</th><th className="p-3">{t('warehouse.thSku')}</th><th className="p-3">{t('warehouse.fieldType')}</th><th className="p-3">{t('warehouse.fieldQuantity')}</th><th className="p-3">{t('warehouse.fieldReason')}</th></tr></thead><tbody className="divide-y divide-slate-800">{inventoryTxs.slice(0, 100).map((tx) => <tr key={tx.id} className="text-slate-300"><td className="p-3">{new Date(tx.timestamp).toLocaleString()}</td><td className="p-3 font-mono">{tx.sku}</td><td className="p-3">{domainLabel(language, tx.type)}</td><td className="p-3">{formatNumber(tx.quantityChange)} {runtimeUnitLabel(language, tx.unit)}</td><td className="p-3">{tx.referenceDoc || '—'}</td></tr>)}</tbody></table></div>

    {showModal && <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4"><div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-md w-full p-5 space-y-4"><h3 className="font-bold text-white">{t('warehouse.modalTitle')}</h3><form onSubmit={submit} className="space-y-3 text-xs"><label className="block text-slate-300">{t('warehouse.fieldItem')}<select value={itemId} onChange={(e) => setItemId(e.target.value)} className="mt-1 w-full field">{inventory.map((item) => <option key={item.id} value={item.id}>{item.sku} — {item.name}</option>)}</select></label><label className="block text-slate-300">{t('warehouse.fieldType')}<select value={txType} onChange={(e) => setTxType(e.target.value as typeof txType)} className="mt-1 w-full field"><option value="Purchase">{domainLabel(language, 'Purchase')}</option><option value="Consumption">{domainLabel(language, 'Consumption')}</option><option value="Adjustment">{domainLabel(language, 'Adjustment')}</option></select></label><label className="block text-slate-300">{t('warehouse.fieldQuantity')}<input type="number" min="0.0001" step="0.0001" value={amount || ''} onChange={(e) => setAmount(Number(e.target.value))} className="mt-1 w-full field" required /></label><label className="block text-slate-300">{t('warehouse.fieldReason')}<input value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full field" /></label><div className="flex justify-end gap-2"><button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg">{t('cancel')}</button><button type="submit" className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-lg">{t('warehouse.btnSubmitTx')}</button></div></form></div></div>}
    <style>{`.field{background:#1e293b;border:1px solid #334155;border-radius:.7rem;padding:.6rem;color:white}`}</style>
  </div>;
};

const Metric: React.FC<{ title: string; value: string; alert?: boolean }> = ({ title, value, alert }) => <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4"><div className="flex items-center gap-2"><span className="text-xs text-slate-400">{title}</span>{alert && <AlertTriangle className="w-4 h-4 text-amber-400" />}</div><strong className="text-xl text-white block mt-1">{value}</strong></div>;
