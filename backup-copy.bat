@echo off
setlocal
cd /d "%~dp0"
rem Copies the "backups" folder to a place OUTSIDE this computer (USB flash, external disk, network folder).
rem Usage: double-click (asks for destination the first time) or "backup-copy.bat auto" (no questions, used by the scheduler).
set "DESTFILE=%~dp0backup-destination.txt"
set "DEST="
if exist "%DESTFILE%" set /p DEST=<"%DESTFILE%"
if not defined DEST (
  if /i "%~1"=="auto" (
    echo No destination set. Run backup-copy.bat by hand once. & exit /b 2
  )
  echo.
  echo Where should the backup copy be saved?
  echo Examples:   E:\MoinTarazBackup      or      \\server\share\MoinTarazBackup
  echo ^(Use a USB flash / external disk / another computer - NOT the same disk as this computer.^)
  set /p DEST=Destination folder: 
  if not defined DEST ( echo Nothing entered. & pause & exit /b 2 )
  >"%DESTFILE%" echo %DEST%
)
if not exist "%DEST%" mkdir "%DEST%" 2>nul
if not exist "%DEST%" (
  echo Cannot reach "%DEST%". Is the flash/disk plugged in?
  if /i not "%~1"=="auto" pause
  exit /b 3
)
echo Copying backups to "%DEST%" ...
robocopy "%~dp0backups" "%DEST%" /E /R:2 /W:3 /NFL /NDL /NP /XF *.tmp
set RC=%ERRORLEVEL%
echo %date% %time% robocopy-exit=%RC% dest=%DEST%>>"%~dp0backup-copy.log"
if %RC% GEQ 8 (
  echo.
  echo COPY FAILED ^(code %RC%^). See above.
  if /i not "%~1"=="auto" pause
  exit /b %RC%
)
echo.
echo Done. Backup files copied to: %DEST%
if /i not "%~1"=="auto" pause
exit /b 0
