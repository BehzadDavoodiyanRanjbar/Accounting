@echo off
net session >/dev/null 2>&1
if %errorlevel% neq 0 (
  echo Please right-click this file and choose "Run as administrator".
  pause
  exit /b 1
)
netsh advfirewall firewall delete rule name="MoinTaraz-3000"
echo.
echo Network access closed.
pause
