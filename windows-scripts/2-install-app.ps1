# Step 2: copies the application to C:\MoinTaraz\app, installs its packages, tests SQL Server with the self-test,
# and registers the application as an auto-start task.  Run as Administrator.  Needs Node.js (LTS 22+) installed.
. "$PSScriptRoot\common.ps1"
Assert-Admin
$src = Join-Path (Split-Path $PSScriptRoot -Parent) 'app'
if (-not (Test-Path (Join-Path $src 'server.js'))) { throw "Application folder not found next to the scripts folder: $src" }
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) { throw 'Node.js is not installed (or PowerShell must be re-opened after installing it). Install Node.js LTS from nodejs.org, then open a NEW PowerShell window.' }
$nodeVer = (& node -v).Trim()
if ([int]($nodeVer.TrimStart('v').Split('.')[0]) -lt 20) { throw "Node.js $nodeVer is too old. Install Node.js LTS 22 or newer." }
$h = Read-EnvFile
if (-not $h['MSSQL_PASSWORD']) { throw 'config\app.env has no SQL settings. Run 1-prepare-sql.ps1 first.' }

Write-Host '[1/6] Copying application files...'
foreach ($d in 'app','logs','backups','scripts') { New-Item -ItemType Directory -Force -Path (Join-Path $Root $d) | Out-Null }
& robocopy $src (Join-Path $Root 'app') /MIR /XD node_modules /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw 'Copying application files failed.' }
Copy-Item (Join-Path $PSScriptRoot '*.ps1') (Join-Path $Root 'scripts') -Force

Write-Host '[2/6] Installing packages (npm)... this can take a few minutes'
if (-not (Install-NpmPackages (Join-Path $Root 'app'))) { throw 'npm install failed after several tries (network). Wait a few minutes and run this script again, or send the messages above.' }

Write-Host '[3/6] Writing settings...'
if (-not $h['DATA_KEY']) { Set-EnvValue 'DATA_KEY' (New-HexKey 32) }
Set-EnvValue 'NODE_EXE' $nodeCmd.Source
Set-EnvValue 'PORT' '3000'
Set-EnvValue 'BIND' '127.0.0.1'
Set-EnvValue 'BACKUP_DIR' (Join-Path $Root 'backups')
Set-EnvValue 'TZ' 'Asia/Tehran'
Set-EnvValue 'MAX_BODY_MB' '150'
Set-EnvValue 'NODE_OPTIONS' '--max-old-space-size=2560'
if (-not $h['ALLOW_REGISTRATION']) { Set-EnvValue 'ALLOW_REGISTRATION' '0' }
if (-not $h['TRUST_PROXY']) { Set-EnvValue 'TRUST_PROXY' '0' }
if (-not $h['HTTPS_ONLY']) { Set-EnvValue 'HTTPS_ONLY' '0' }
icacls (Join-Path $Root 'config') /inheritance:r /grant:r 'SYSTEM:(OI)(CI)F' 'Administrators:(OI)(CI)F' 'NT AUTHORITY\LOCAL SERVICE:(OI)(CI)R' | Out-Null
icacls (Join-Path $Root 'app') /inheritance:r /grant:r 'SYSTEM:(OI)(CI)F' 'Administrators:(OI)(CI)F' 'NT AUTHORITY\LOCAL SERVICE:(OI)(CI)RX' | Out-Null
icacls (Join-Path $Root 'scripts') /inheritance:r /grant:r 'SYSTEM:(OI)(CI)F' 'Administrators:(OI)(CI)F' 'NT AUTHORITY\LOCAL SERVICE:(OI)(CI)RX' | Out-Null
foreach ($d in 'logs','backups') { icacls (Join-Path $Root $d) /inheritance:r /grant:r 'SYSTEM:(OI)(CI)F' 'Administrators:(OI)(CI)F' 'NT AUTHORITY\LOCAL SERVICE:(OI)(CI)M' | Out-Null }

Write-Host '[4/6] Running the SQL Server self-test (uses the MoinTarazTest database only)...'
$e = Import-EnvToProcess
$env:MSSQL_DATABASE = 'MoinTarazTest'
Push-Location (Join-Path $Root 'app')
& node mssql-selftest.js
$st = $LASTEXITCODE
Pop-Location
$env:MSSQL_DATABASE = $e['MSSQL_DATABASE']
if ($st -ne 0) { throw 'SQL Server self-test FAILED. Do not continue. Copy the lines above and send them to support.' }

Write-Host '[5/6] Registering the auto-start task...'
$act = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -ExecutionPolicy Bypass -File "' + (Join-Path $Root 'scripts\run-app.ps1') + '"')
$trg = New-ScheduledTaskTrigger -AtStartup
$set = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$pr = New-ScheduledTaskPrincipal -UserId 'NT AUTHORITY\LOCAL SERVICE' -LogonType ServiceAccount -RunLevel Limited
Register-ScheduledTask -TaskName 'MoinTaraz-App' -Action $act -Trigger $trg -Settings $set -Principal $pr -Force | Out-Null

Write-Host '[6/6] Starting the application...'
Stop-MoinApp
Start-MoinApp
if (Wait-Health 120) {
    Write-Host ''
    Write-Host 'The application is running (only on this server: http://127.0.0.1:3000).'
    Write-Host 'IMPORTANT: make an offline copy of C:\MoinTaraz\config\app.env  (it holds DATA_KEY; without it encrypted keys cannot be recovered).'
    Write-Host 'Next: 3-setup-https.ps1 -Domain your.domain.ir'
} else {
    Write-Host 'The application did not answer in time. Look at C:\MoinTaraz\logs\app.log'
    Get-Content (Join-Path $Root 'logs\app.log') -Tail 30 -ErrorAction SilentlyContinue
    throw 'Start-up check failed.'
}
