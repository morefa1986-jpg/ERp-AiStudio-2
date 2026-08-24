# Real-World ERP Hardening Backlog

این فایل معیار تکمیل واقعی ERP است. سبز بودن Build به‌تنهایی به‌معنای Done نیست.

## Definition of Done
هر مورد زمانی Done است که:
1. منطق Domain/Server اصلاح شده باشد؛
2. مسیر UI در صورت نیاز اصلاح شده باشد؛
3. Regression Test داشته باشد؛
4. Enterprise CI سبز باشد؛
5. برای تغییرات Windows/LAN، QA مرتبط نیز سبز باشد.

## P0 — یکپارچگی داده و دسترسی
- [x] جلوگیری از Last-Write-Wins کور در Conflict و Three-Way Merge برای تغییرات مستقل.
- [x] Fail-Closed برای تغییر هم‌زمان روی یک رکورد.
- [x] Durable per-user staged outbox در IndexedDB با fallback محدود و ownership کاربر.
- [ ] تبدیل Outbox از snapshot تک‌عملیاتی به command queue چندماژوله برای آفلاین طولانی.
- [ ] Server-enforced Hall/Pond scope برای Read و Write و Conflict responses.
- [ ] Master Data CRUD واقعی برای سالن، استخر، ابعاد/حجم، گونه و موجودی اولیه.
- [ ] Mixed-species / sex-count ledger و conservation در تلفات، انتقال و بیومتری.
- [x] Exact batch identity در fallback فروش؛ حذف تطبیق مبهم نوع محصول.
- [ ] Traceability قطعی Sale Line → Cold Storage Lot → Processing Batch.
- [ ] Permit/export gate در Server invariant، نه فقط UI.
- [ ] FX accounting end-to-end و رفع تناقض Engine/Server.

## P1 — عملیات روزانه
- [x] رد مصرف خوراک منقضی در Feeding Engine.
- [ ] Server-side feed-expiry invariant برای جلوگیری از bypass کلاینت.
- [ ] Shared sensor mapping و validated ingestion برای «بررسی آنلاین پارامترهای آب».
- [ ] Server-shared module visibility.
- [ ] Emergency alert, acknowledgement و escalation workflow.
- [ ] Full disaster-recovery backup شامل کاربران و تنظیمات مشترک.
- [ ] Night-shift cross-midnight و operational local-date/time.
- [ ] Payroll configuration و قواعد مالی قابل تنظیم.
- [ ] Accounting auto-posting از فروش، انبار، حقوق و فرآوری.
- [ ] CRM receivables/payment/aging.
- [ ] Transfer workflow به مقصدهای خارجی با ledger مقصد معتبر.
- [ ] Feed Factory workflow واقعی.
- [ ] Laboratory workflow کامل.
- [ ] Maintenance PM/work-order/spares/cost/downtime.
- [ ] Cold Storage movements/locations/temperature excursion/cycle count.
- [ ] شفاف‌سازی Scope گزارش‌های global در برابر pond/hall-scoped.
- [ ] Tamper-evident audit trail.
- [ ] اتصال رسمی شبکه‌های اجتماعی فقط پس از OAuth/API واقعی.
- [ ] اتصال دستگاه حضور و غیاب فقط پس از شناسایی واقعی پروتکل/SDK/فرمت خروجی.

## P2 — فروش و استقرار تجاری
- [ ] Windows code signing / publisher identity.
- [ ] CI نصب واقعی: install → launch → restart → uninstall.
- [ ] Dynamic/fallback Electron port allocation.
- [ ] کاهش bottleneck ناشی از single JSON state و حرکت تدریجی به command/domain tables.
- [ ] حذف hard-coded UI strings و تست i18n برای Viewها.
- [ ] E2E گسترده: concurrent clients, network loss, restart-before-sync, clean restore, night shift, multi-species, FX sync, traceability.

## Project invariants
- Feeding در مزرعه دستی است؛ ERP نباید فرمان PLC/Feeder صادر کند.
- نام قابل‌مشاهده قابلیت پایش فقط «بررسی آنلاین پارامترهای آب» است.
- هیچ اتصال سخت‌افزار یا سرویس خارجی بدون تست واقعی «کامل» اعلام نمی‌شود.
