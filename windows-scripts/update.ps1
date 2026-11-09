# Installs a new version.  Usage:  .\update.ps1 -Zip C:\MoinTaraz\incoming\moin-taraz-release.zip
# The zip must contain the "app" folder (as delivered).  A database backup and a copy of the old program are made first;
# if the new version does not start, the old program is restored automatically.
param([Parameter(Mandatory = $true)][string]$Zip)
. "$PSScriptRoot\common.ps1"
Assert-Admin
if (-not (Test-Path $Zip)) { throw "File not found: $Zip" }
$tmp = Join-Path $Root 'incoming\_unzipped'
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
Expand-Archive -LiteralPath $Zip -DestinationPath $tmp -Force
$new = Get-ChildItem $tmp -Recurse -Filter 'server.js' | Where-Object { $_.Directory.Name -eq 'app' } | Select-Object -First 1
if (-not $new) { throw 'The zip does not contain app\server.js - wrong file.' }
$newApp = $new.Directory.FullName
Write-Host '[1/6] Backing up the database...'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root 'scripts\backup-sql.ps1') -Mode Full
if ($LASTEXITCODE -ne 0) { throw 'Database backup failed - update cancelled (nothing changed).' }
Write-Host '[2/6] Stopping the application...'
Stop-MoinApp
$app = Join-Path $Root 'app'; $prev = Join-Path $Root 'app-prev'
Write-Host '[3/6] Saving a copy of the current program...'
if (Test-Path $prev) { Remove-Item $prev -Recurse -Force }
& robocopy $app $prev /E /XD node_modules /NFL /NDL /NJH /NJS /NP | Out-Null
Write-Host '[4/6] Installing the new version...'
& robocopy $newApp $app /MIR /XD node_modules /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw 'Copy failed.' }
$npmRc = if (Install-NpmPackages $app) { 0 } else { 1 }
icacls $app /inheritance:r /grant:r 'SYSTEM:(OI)(CI)F' 'Administrators:(OI)(CI)F' 'NT AUTHORITY\LOCAL SERVICE:(OI)(CI)RX' | Out-Null
if (Test-Path (Join-Path $newApp '..\scripts')) { Copy-Item (Join-Path $newApp '..\scripts\*.ps1') (Join-Path $Root 'scripts') -Force }
Write-Host '[5/6] Starting...'
Start-MoinApp
$ok = ($npmRc -eq 0) -and (Wait-Health 120)
if ($ok) {
    Write-Host '[6/6] The new version is running. Press Ctrl+F5 in the browser.'
    Remove-Item $tmp -Recurse -Force
} else {
    Write-Host 'The new version did not start. Restoring the previous program...'
    Stop-MoinApp
    & robocopy $prev $app /MIR /XD node_modules /NFL /NDL /NJH /NJS /NP | Out-Null
    Install-NpmPackages $app | Out-Null
    Start-MoinApp
    if (Wait-Health 120) { Write-Host 'The previous version is running again. Send C:\MoinTaraz\logs\app.log to support.' } else { Write-Host 'Previous version also failed to start. See C:\MoinTaraz\logs\app.log' }
    exit 1
}
