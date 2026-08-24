import React from 'react';
import { ShieldCheck, Utensils } from 'lucide-react';

export const ManualFeedingModeNotice: React.FC = () => (
  <section className="mb-5 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 shadow-sm">
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
        <Utensils className="h-5 w-5 text-amber-400" />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-black text-white">حالت خوراک‌دهی: دستی</h2>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
            <ShieldCheck className="h-3 w-3" /> بدون فرمان خودکار به تجهیزات
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-5 text-slate-400">
          ERP مقدار پیشنهادی، محدودیت‌های ایمنی، ثبت مقدار واقعی خوراک، FCR و موجودی انبار را مدیریت می‌کند؛ مقدار واقعی توسط اپراتور وارد و خوراک به‌صورت دستی توزیع می‌شود.
        </p>
      </div>
    </div>
  </section>
);
