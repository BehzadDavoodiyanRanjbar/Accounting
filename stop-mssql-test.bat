@echo off
cd /d "%~dp0"
docker compose -f docker-compose.mssql.yml down
echo Stopped. Test data is kept. (never use -v)
pause
