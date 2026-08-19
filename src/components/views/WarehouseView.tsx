import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { useFarm } from '../../context/FarmContext';
import {
  Package,
  Plus,
  AlertTriangle,
  Search,
  ArrowDownUp,
  DollarSign,
  Building,
  CheckCircle2,
} from 'lucide-react';
import { InventoryItem, InventoryTransaction, InventoryTxType } from '../../types';

export const WarehouseView: React.FC = () => {
  const { t, formatNumber, formatCurrency, formatDate } = useI18n();
  const {
    inventory,
    inventoryTxs,
    addInventoryTransaction,
  } = useFarm();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showMovementModal, setShowMovementModal] = useState<boolean>(false);

  // Movement State
  const [moveItemId, setMoveItemId] = useState<string>(inventory[0]?.id || '');
  const [moveType, setMoveType] = useState<InventoryTxType>('Purchase (خرید)');
  const [moveQty, setMoveQty] = useState<number>(10);
  const [moveReason, setMoveReason] = useState<string>('شارژ موجودی انبار');

  const filteredItems = inventory.filter((item) => {
    const matchSearch =
      searchQuery === '' ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchSearch;
  });

  const lowStockItems = inventory.filter((i) => i.quantity <= i.reorderLevel);

  const handleExecuteMovement = (e: React.FormEvent) => {
    e.preventDefault();
    const item = inventory.find((i) => i.id === moveItemId);
    if (!item) return;

    const isPositive = moveType.includes('Purchase') || moveType.includes('Production') || moveType.includes('Adjustment');
    const change = isPositive ? Math.abs(moveQty) : -Math.abs(moveQty);

    addInventoryTransaction({
      itemId: item.id,
      itemName: item.name,
      sku: item.sku,
      type: moveType,
      quantityChange: change,
      unit: item.unit,
      unitPrice: item.purchasePricePerUnit,
      totalValue: Math.abs(change) * item.purchasePricePerUnit,
      operator: 'مسئول انبار و زنجیره تأمین',
      notes: moveReason,
    });

    setShowMovementModal(false);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2.5">
            <Package className="w-6 h-6 text-amber-400" />
            انبارداری، موجودی کالا و زنجیره تأمین (Warehouse & Inventory)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            مدیریت خوراک، مکمل‌ها، اقلام بسته‌بندی لوکس خاویار، تجهیزات و ردیابی لات نامبر
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMovementModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-blue-600/20"
          >
            <ArrowDownUp className="w-4 h-4" />
            ثبت تراکنش ورود/خروج کالا
          </button>
        </div>
      </div>

      {/* Warning banner for low stock */}
      {lowStockItems.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <strong className="text-amber-300 font-bold">هشدار نقطه سفارش (Low Stock Alert):</strong>
              <span className="text-slate-300 mr-1.5">
                تعداد {lowStockItems.length} قلم کالا به حد آستانه حداقل موجودی رسیده‌اند.
              </span>
            </div>
          </div>
          <span className="font-mono text-amber-400 font-bold bg-amber-500/20 px-2 py-1 rounded">
            نیاز به سفارش‌گذاری مجدد
          </span>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو در انبار (نام کالا، بارکد، دسته‌بندی، لات نامبر)..."
            className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl pr-10 pl-4 py-2.5 text-xs focus:border-amber-500"
          />
        </div>
      </div>

      {/* Inventory Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((item) => {
          const isLow = item.quantity <= item.reorderLevel;
          return (
            <div
              key={item.id}
              className={`bg-slate-900 border rounded-2xl p-5 shadow-sm space-y-3 ${
                isLow ? 'border-amber-500/40 bg-amber-500/5' : 'border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-white">{item.name}</h3>
                  <span className="text-[11px] text-slate-400">{item.category}</span>
                </div>
                <span className="font-mono text-xs text-amber-400 bg-slate-950 px-2 py-1 rounded">
                  {item.sku}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">محل استقرار:</span>
                  <strong className="text-white">{item.warehouseLocation}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">موجودی فعلی:</span>
                  <strong
                    className={`font-mono text-sm ${
                      isLow ? 'text-amber-400 font-bold' : 'text-emerald-400'
                    }`}
                  >
                    {formatNumber(item.quantity)} {item.unit}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">حد سفارش مجدد:</span>
                  <span className="font-mono text-slate-400">{item.reorderLevel} {item.unit}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">قیمت واحد خرید:</span>
                  <strong className="text-slate-200 font-mono">
                    {formatCurrency(item.purchasePricePerUnit)}
                  </strong>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[11px]">
                <span className="text-slate-400 font-mono">بچ: {item.batchNumber}</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    isLow
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {item.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Movement Modal */}
      {showMovementModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-blue-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <ArrowDownUp className="w-5 h-5 text-blue-400" />
              ثبت حواله ورود یا خروج کالا از انبار
            </h3>

            <form onSubmit={handleExecuteMovement} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">کالا / متریال:</label>
                <select
                  value={moveItemId}
                  onChange={(e) => setMoveItemId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                >
                  {inventory.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.sku}) — موجودی: {i.quantity} {i.unit}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">نوع عملیات انبار:</label>
                  <select
                    value={moveType}
                    onChange={(e) => setMoveType(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-bold"
                  >
                    <option value="Purchase (خرید)">ورود (خرید / شارژ)</option>
                    <option value="Consumption (مصرف روزانه)">خروج (مصرف روزانه)</option>
                    <option value="Adjustment (تعدیل موجودی)">تعدیل انبارگردانی</option>
                    <option value="Waste (ضایعات)">ضایعات / امحا</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">مقدار (تعداد/کیلو):</label>
                  <input
                    type="number"
                    value={moveQty}
                    onChange={(e) => setMoveQty(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-bold text-amber-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">شرح و علت حواله:</label>
                <input
                  type="text"
                  value={moveReason}
                  onChange={(e) => setMoveReason(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMovementModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl"
                >
                  ثبت سند انبار
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
