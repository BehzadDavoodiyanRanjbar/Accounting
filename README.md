# حسابداری ۶ سطحی معین تراز

نرم‌افزار حسابداری/خرید/فروش/تولید/بهای تمام‌شدهٔ خدمات (فارسی، راست‌به‌چپ).

- `app/` — سرور Node.js (PostgreSQL یا SQL Server) و منطق کسب‌وکار (`app/gs`)؛ OCR سمت سرور با Tesseract (`app/ocr.js`, `app/tessdata`)
- `web/` — رابط کاربری React + Ant Design (`npm install && npm run build`، خروجی را در `app/public/v2` کپی کنید)
- `windows-scripts/` — اسکریپت‌های نصب روی Windows Server + SQL Server
- Docker: `start.bat` (راهنما: `راهنمای-نصب-نسخه-Docker.md`)

فایل `.env`، پوشهٔ `backups` و داده‌ی مشتریان هرگز در مخزن قرار نمی‌گیرند.
