# Imports a full backup file (backup-....json.gz made by the old/local program) into the EMPTY SQL Server database.
# Usage:  .\import-data.ps1 -File C:\MoinTaraz\incoming\backup-2026-10-26-04-30.json.gz   [-Replace]
param([Parameter(Mandatory = $true)][string]$File, [switch]$Replace)
. "$PSScriptRoot\common.ps1"
Assert-Admin
if (-not (Test-Path $File)) { throw "File not found: $File" }
Write-Host 'Stopping the application...'
Stop-MoinApp
$e = Import-EnvToProcess
Write-Host 'Making a safety backup of the current database first...'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'backup-sql.ps1') -Mode Full
Push-Location (Join-Path $Root 'app')
if ($Replace) { & node import-backup.js $File --replace } else { & node import-backup.js $File }
$rc = $LASTEXITCODE
Pop-Location
if ($rc -ne 0) { Write-Host 'IMPORT FAILED. The application stays stopped. Send the messages above to support.'; exit 1 }
Write-Host 'Import verified. Starting the application...'
Start-MoinApp
if (Wait-Health 120) { Write-Host 'Done. Log in with the same username and password you used on the old system.' } else { Write-Host 'The application did not start; see C:\MoinTaraz\logs\app.log' }
