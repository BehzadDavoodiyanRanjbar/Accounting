# Shows a quick health summary.
. "$PSScriptRoot\common.ps1"
Write-Host '--- tasks ---'
Get-ScheduledTask -TaskName 'MoinTaraz-*' -ErrorAction SilentlyContinue | ForEach-Object { '{0,-22} {1}' -f $_.TaskName, $_.State }
Write-Host '--- services ---'
Get-Service MSSQLSERVER | ForEach-Object { '{0,-22} {1}' -f $_.Name, $_.Status }
Write-Host '--- application ---'
try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/health' -UseBasicParsing -TimeoutSec 5; 'health: ' + $r.StatusCode } catch { 'health: NOT RESPONDING' }
Get-Process node -ErrorAction SilentlyContinue | ForEach-Object { 'node pid {0}  memory {1} MB' -f $_.Id, [math]::Round($_.WorkingSet64 / 1MB) }
Write-Host '--- disk ---'
Get-PSDrive C | ForEach-Object { 'C: free {0} GB' -f [math]::Round($_.Free / 1GB, 1) }
Write-Host '--- last backups ---'
Get-ChildItem (Join-Path $Root 'sqlbackups') -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 3 | ForEach-Object { '{0}  {1} MB  {2}' -f $_.Name, [math]::Round($_.Length / 1MB, 1), $_.LastWriteTime }
Write-Host '--- last log lines ---'
Get-Content (Join-Path $Root 'logs\app.log') -Tail 8 -ErrorAction SilentlyContinue
