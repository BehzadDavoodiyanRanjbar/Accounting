@echo off
net session >/dev/null 2>&1
if %errorlevel% neq 0 (
  echo Please right-click this file and choose "Run as administrator".
  pause
  exit /b 1
)
netsh advfirewall firewall delete rule name="MoinTaraz-3000" >/dev/null 2>&1
netsh advfirewall firewall add rule name="MoinTaraz-3000" dir=in action=allow protocol=TCP localport=3000 remoteip=localsubnet profile=any
echo.
echo Done. Other computers on the same network can open: http://192.168.1.109:3000
pause
