@echo off
cd /d "%~dp0"
echo.
echo WARNING: this DELETES ALL app data (companies, invoices, keys) and starts fresh.
choice /c YN /n /m "Continue? (Y/N) "
if errorlevel 2 exit /b
docker compose down -v
docker volume rm moin_taraz_pgdata >nul 2>&1
docker compose up -d --build
echo.
echo Fresh install done. Open: http://localhost:3000
pause
