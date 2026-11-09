@echo off
cd /d "%~dp0"
echo ===== docker version ===== > diag.txt
docker version >> diag.txt 2>&1
echo. >> diag.txt
echo ===== docker compose ps ===== >> diag.txt
docker compose ps -a >> diag.txt 2>&1
echo. >> diag.txt
echo ===== app logs ===== >> diag.txt
docker compose logs --tail 80 app >> diag.txt 2>&1
echo. >> diag.txt
echo ===== db logs ===== >> diag.txt
docker compose logs --tail 40 db >> diag.txt 2>&1
echo diag.txt created. Send its content to support.
pause
