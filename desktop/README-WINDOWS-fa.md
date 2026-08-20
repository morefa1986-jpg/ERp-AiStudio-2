# نسخه ویندوز Fathi Aqua SuperERP

این نسخه مستقل از Google AI Studio اجرا می‌شود و برای اجرای هسته ERP به Gemini API نیاز ندارد.

## نصب

فایل `FathiAquaSuperERP-Setup-6.1.0-x64.exe` را اجرا کنید.

نصاب:
- نصب برای کاربر فعلی ویندوز را انجام می‌دهد.
- امکان انتخاب پوشه نصب را می‌دهد.
- Shortcut روی Desktop ایجاد می‌کند.
- Shortcut در Start Menu ایجاد می‌کند.
- Uninstaller را در Windows Settings > Apps ثبت می‌کند.

## حذف برنامه

از مسیر Windows Settings > Apps > Installed apps، گزینه `Fathi Aqua SuperERP` را Uninstall کنید.

حذف عادی برنامه، اطلاعات ERP را عمداً پاک نمی‌کند. داده‌های محلی، کتابخانه رسانه و تنظیمات در مسیر زیر حفظ می‌شوند:

`%LOCALAPPDATA%\FathiAquaSuperERP`

این رفتار برای جلوگیری از حذف تصادفی اطلاعات مزرعه است.

## حذف کامل اطلاعات محلی

فقط اگر مطمئن هستید که دیگر به داده‌ها نیاز ندارید، ابزار زیر را با پارامتر تأیید اجرا کنید:

`desktop\tools\Remove-FathiAquaSuperERP-UserData.ps1 -ConfirmDelete`

قبل از حذف کامل، از داخل ERP یک Backup بگیرید.

## نسخه Portable

فایل ZIP با نام `FathiAquaSuperERP-Portable-6.1.0-x64.zip` نیاز به نصب ندارد. آن را Extract کرده و `FathiAquaSuperERP.exe` را اجرا کنید.

## نکته امنیتی

نسخه‌های تولیدشده توسط GitHub Actions در حال حاضر بدون گواهی Code Signing تجاری ساخته می‌شوند؛ بنابراین Windows SmartScreen ممکن است در اولین اجرا هشدار ناشر ناشناخته نمایش دهد. این هشدار به معنی خراب بودن فایل نیست. برای توزیع تجاری عمومی، Code Signing باید در مرحله انتشار رسمی اضافه شود.
