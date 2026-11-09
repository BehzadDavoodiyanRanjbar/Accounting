# Runs the application forever (restarts it if it stops). Started by the scheduled task "MoinTaraz-App".
$ErrorActionPreference = 'Continue'
$Root = 'C:\MoinTaraz'
$envFile = Join-Path $Root 'config\app.env'
$logDir = Join-Path $Root 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
foreach ($line in Get-Content -LiteralPath $envFile -Encoding UTF8) {
    $t = $line.Trim(); if ($t -eq '' -or $t.StartsWith('#')) { continue }
    $i = $t.IndexOf('='); if ($i -gt 0) { Set-Item -Path ('Env:' + $t.Substring(0, $i).Trim()) -Value $t.Substring($i + 1).Trim() }
}
$node = $env:NODE_EXE; if (-not $node) { $node = 'node' }
Set-Location (Join-Path $Root 'app')
while ($true) {
    $log = Join-Path $logDir 'app.log'
    if ((Test-Path $log) -and ((Get-Item $log).Length -gt 20MB)) { Move-Item $log (Join-Path $logDir ('app-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')) -Force }
    Get-ChildItem $logDir -Filter 'app-*.log' | Sort-Object LastWriteTime -Descending | Select-Object -Skip 10 | Remove-Item -Force -ErrorAction SilentlyContinue
    Add-Content -Path $log -Value ('=== start ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + ' ===')
    & cmd.exe /c ('"' + $node + '" server.js >> "' + $log + '" 2>&1')
    Add-Content -Path $log -Value ('=== exited with code ' + $LASTEXITCODE + ' at ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + ', restarting in 5s ===')
    Start-Sleep -Seconds 5
}
