@echo off
setlocal
cd /d "%~dp0"
rem Creates a Windows scheduled task: every day at 23:30 copy backups to the destination saved by backup-copy.bat
if not exist "%~dp0backup-destination.txt" (
  echo First run backup-copy.bat once and choose the destination folder.
  pause & exit /b 2
)
schtasks /create /tn "MoinTaraz-BackupCopy" /tr "\"%~dp0backup-copy.bat\" auto" /sc daily /st 23:30 /f
if errorlevel 1 ( echo Failed. Right-click this file and choose "Run as administrator". & pause & exit /b 1 )
echo.
echo Scheduled: every day 23:30. ^(The computer must be ON at that time.^)
echo To remove it later run: unschedule-backup-copy.bat
pause
