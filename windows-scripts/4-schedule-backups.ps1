# Step 4: schedules SQL Server backups (full every night 02:00, transaction-log every 15 minutes).  Run as Administrator.
. "$PSScriptRoot\common.ps1"
Assert-Admin
$bk = Join-Path $Root 'sqlbackups'
New-Item -ItemType Directory -Force -Path $bk | Out-Null
# SQL Server's own service account must be able to write the backup files
icacls $bk /grant 'NT SERVICE\MSSQLSERVER:(OI)(CI)M' 'SYSTEM:(OI)(CI)F' 'Administrators:(OI)(CI)F' | Out-Null
$script = Join-Path $Root 'scripts\backup-sql.ps1'
Copy-Item (Join-Path $PSScriptRoot 'backup-sql.ps1') $script -Force
Copy-Item (Join-Path $PSScriptRoot 'common.ps1') (Join-Path $Root 'scripts\common.ps1') -Force
$set = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 2) -StartWhenAvailable
$pr = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$a1 = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -ExecutionPolicy Bypass -File "' + $script + '" -Mode Full')
Register-ScheduledTask -TaskName 'MoinTaraz-SqlFull' -Action $a1 -Trigger (New-ScheduledTaskTrigger -Daily -At '02:00') -Settings $set -Principal $pr -Force | Out-Null
$a2 = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -ExecutionPolicy Bypass -File "' + $script + '" -Mode Log')
Register-ScheduledTask -TaskName 'MoinTaraz-SqlLog' -Action $a2 -Trigger (New-ScheduledTaskTrigger -Once -At (Get-Date).Date.AddMinutes(5) -RepetitionInterval (New-TimeSpan -Minutes 15) -RepetitionDuration (New-TimeSpan -Days 3650)) -Settings $set -Principal $pr -Force | Out-Null
Write-Host 'Running the first full backup now...'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $script -Mode Full
if ($LASTEXITCODE -ne 0) { throw 'First backup failed. See C:\MoinTaraz\logs\backup.log' }
Get-ChildItem $bk | Sort-Object LastWriteTime -Descending | Select-Object -First 3 Name, Length, LastWriteTime | Format-Table -AutoSize
Write-Host 'Done. Backups are in C:\MoinTaraz\sqlbackups. Remember to copy them OFF this server (see the guide).'
