@echo off
cd /d "%~dp0"
echo ============================================================
echo  This deletes ALL software users (names and passwords) only.
echo  Invoices, companies and all other data are NOT touched.
echo  Afterwards open http://localhost:3000 and create a new admin.
echo ============================================================
set /p OK=Type YES and press Enter to continue: 
if /I not "%OK%"=="YES" goto end
docker compose exec -T db psql -U postgres -c "DELETE FROM rows WHERE sheet='Users' AND data->>0 LIKE 'USR-%%';"
docker compose restart app
echo.
echo Done. Open http://localhost:3000 and create the first admin again.
:end
pause
