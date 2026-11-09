@echo off
cd /d "%~dp0"
echo Running SQL Server self-test (database MoinTarazTest only)...
docker compose -f docker-compose.mssql.yml run --rm -e MSSQL_DATABASE=MoinTarazTest app node mssql-selftest.js
pause
