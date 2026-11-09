@echo off
cd /d "%~dp0"
docker compose up -d --build
echo.
echo App started. Open in browser: http://localhost:3000
pause
