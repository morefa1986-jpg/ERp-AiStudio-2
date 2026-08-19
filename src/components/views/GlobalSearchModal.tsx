import React, { useState } from 'react';
import { Search, X, Fish, Egg, DollarSign, Package, UserCheck, ArrowRight } from 'lucide-react';
import { useFarm } from '../../context/FarmContext';
import { useI18n } from '../../i18n';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectNav: (viewId: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectNav,
}) => {
  const { t } = useI18n();
  const { ponds, broodstock, proformas, inventory, employees } = useFarm();
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const matchedPonds = ponds.filter(
    (p) => p.name.toLowerCase().includes(query.toLowerCase()) || p.number.toLowerCase().includes(query.toLowerCase())
  );

  const matchedBroodstock = broodstock.filter(
    (b) => b.chipNumber.includes(query) || b.plateNumber.toLowerCase().includes(query.toLowerCase())
  );

  const matchedProformas = proformas.filter(
    (pr) =>
      pr.invoiceNumber.toLowerCase().includes(query.toLowerCase()) ||
      pr.customerName.toLowerCase().includes(query.toLowerCase())
  );

  const matchedInventory = inventory.filter(
    (i) => i.name.toLowerCase().includes(query.toLowerCase()) || i.sku.toLowerCase().includes(query.toLowerCase())
  );

  const hasResults =
    query.trim() !== '' &&
    (matchedPonds.length > 0 ||
      matchedBroodstock.length > 0 ||
      matchedProformas.length > 0 ||
      matchedInventory.length > 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center pt-20 px-4 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#121214] border border-[#1F1F22] rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden">
        {/* Search Bar Input */}
        <div className="p-4 border-b border-[#1F1F22] flex items-center gap-3 bg-[#18181B]">
          <div className="w-2 h-2 rounded-full bg-[#D4AF37] shrink-0" />
          <Search className="w-4 h-4 text-[#71717A] shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Global Search (ماهی، استخر، فاکتور، میکروچیپ RFID، انبار)..."
            className="w-full bg-transparent text-white text-xs focus:outline-none placeholder:text-[#71717A]"
          />
          <button
            onClick={onClose}
            className="p-1 text-[#71717A] hover:text-white rounded-lg hover:bg-[#1F1F22] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results Container */}
        <div className="max-h-96 overflow-y-auto p-4 space-y-4 text-xs">
          {query.trim() === '' ? (
            <div className="text-center py-8 text-[#71717A]">
              <p className="text-xs">برای جستجو در کل ماژول‌های مزرعه خاویاری، عبارتی را تایپ نمایید...</p>
              <div className="flex justify-center gap-2 mt-3">
                <span className="px-2 py-0.5 bg-[#18181B] border border-[#27272A] rounded text-[10px] text-[#A1A1AA]">
                  P-101
                </span>
                <span className="px-2 py-0.5 bg-[#18181B] border border-[#27272A] rounded text-[10px] text-[#A1A1AA]">
                  RFID 9002
                </span>
                <span className="px-2 py-0.5 bg-[#18181B] border border-[#27272A] rounded text-[10px] text-[#A1A1AA]">
                  Beluga Imperial
                </span>
              </div>
            </div>
          ) : !hasResults ? (
            <div className="text-center py-8 text-[#71717A]">
              موردی مطابق با عبارت «{query}» یافت نشد.
            </div>
          ) : (
            <>
              {/* Ponds */}
              {matchedPonds.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-bold text-[#71717A] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Fish className="w-3.5 h-3.5 text-[#D4AF37]" />
                    استخرهای پرورشی ({matchedPonds.length})
                  </h4>
                  <div className="space-y-1">
                    {matchedPonds.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          onSelectNav('ponds');
                          onClose();
                        }}
                        className="w-full text-right p-2.5 bg-[#18181B] hover:bg-[#1F1F22] border border-[#27272A] rounded-xl flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div>
                          <span className="font-bold text-white">{p.number} — {p.name}</span>
                          <span className="text-[10px] text-[#71717A] mr-2 font-mono">
                            {p.biomassKg} kg | DO: {p.dissolvedOxygen} mg/L
                          </span>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-[#71717A]" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Broodstock RFID */}
              {matchedBroodstock.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-bold text-[#71717A] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Egg className="w-3.5 h-3.5 text-[#D4AF37]" />
                    مولدین و چیپست RFID ({matchedBroodstock.length})
                  </h4>
                  <div className="space-y-1">
                    {matchedBroodstock.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => {
                          onSelectNav('hatchery');
                          onClose();
                        }}
                        className="w-full text-right p-2.5 bg-[#18181B] hover:bg-[#1F1F22] border border-[#27272A] rounded-xl flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div>
                          <span className="font-bold text-white font-mono">{b.chipNumber}</span>
                          <span className="text-[10px] text-[#A1A1AA] mr-2">
                            {b.speciesId} ({b.sex}) — وزن: {b.weightKg} kg
                          </span>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-[#71717A]" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Invoices */}
              {matchedProformas.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-bold text-[#71717A] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    پیش‌فاکتورها و فروش ({matchedProformas.length})
                  </h4>
                  <div className="space-y-1">
                    {matchedProformas.map((pr) => (
                      <button
                        key={pr.id}
                        onClick={() => {
                          onSelectNav('sales');
                          onClose();
                        }}
                        className="w-full text-right p-2.5 bg-[#18181B] hover:bg-[#1F1F22] border border-[#27272A] rounded-xl flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div>
                          <span className="font-bold text-white font-mono">{pr.invoiceNumber}</span>
                          <span className="text-[10px] text-[#A1A1AA] mr-2">
                            مشتری: {pr.customerName} | مبلغ: {pr.grandTotal} {pr.currency}
                          </span>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-[#71717A]" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
