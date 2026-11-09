@echo off
cd /d "%~dp0"
echo Starting SQL Server test version (separate from your real data)...
docker compose -f docker-compose.mssql.yml up -d --build
echo.
echo Open in browser: http://localhost:3001   (first start may take 1-2 minutes)
pause
