# Step 3: public HTTPS with automatic certificate (Caddy).  Run as Administrator.
# Before running: the domain's DNS "A" record must already point to this server's public IP, and ports 80 and 443 must be open at the provider firewall.
param([Parameter(Mandatory = $true)][string]$Domain, [string]$Email = '')
. "$PSScriptRoot\common.ps1"
Assert-Admin
if ($Domain -notmatch '^[A-Za-z0-9]([A-Za-z0-9\-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9\-]*[A-Za-z0-9])?)+$') { throw 'The domain looks wrong. Example: app.example.ir' }
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$cd = Join-Path $Root 'caddy'
New-Item -ItemType Directory -Force -Path $cd, (Join-Path $cd 'data'), (Join-Path $cd 'config') | Out-Null
$exe = Join-Path $cd 'caddy.exe'
if (-not (Test-Path $exe)) {
    Write-Host '[1/5] Downloading Caddy...'
    Invoke-WebRequest -Uri 'https://caddyserver.com/api/download?os=windows&arch=amd64' -OutFile $exe -UseBasicParsing
}
& $exe version
if ($LASTEXITCODE -ne 0) { throw 'caddy.exe is not working (download problem). Delete C:\MoinTaraz\caddy\caddy.exe and run again.' }

Write-Host '[2/5] Writing Caddyfile...'
$gl = ''
if ($Email) { $gl = "{`r`n    email $Email`r`n}`r`n" }
$caddyfile = $gl + @"
$Domain {
    encode zstd gzip
    request_body {
        max_size 150MB
    }
    reverse_proxy 127.0.0.1:3000
}
"@
[IO.File]::WriteAllText((Join-Path $cd 'Caddyfile'), $caddyfile, (New-Object Text.UTF8Encoding($false)))

Write-Host '[3/5] Firewall: allowing 80 and 443 (and nothing else)...'
foreach ($p in 80, 443) {
    $n = "MoinTaraz-HTTP-$p"
    if (-not (Get-NetFirewallRule -DisplayName $n -ErrorAction SilentlyContinue)) { New-NetFirewallRule -DisplayName $n -Direction Inbound -Protocol TCP -LocalPort $p -Action Allow | Out-Null }
}
icacls $cd /inheritance:r /grant:r 'SYSTEM:(OI)(CI)F' 'Administrators:(OI)(CI)F' 'NT AUTHORITY\LOCAL SERVICE:(OI)(CI)M' | Out-Null

Write-Host '[4/5] Registering the Caddy auto-start task...'
$runner = @'
$root = 'C:\MoinTaraz\caddy'
$env:XDG_DATA_HOME = "$root\data"; $env:XDG_CONFIG_HOME = "$root\config"; $env:APPDATA = "$root\config"
Set-Location $root
while ($true) {
    & cmd.exe /c ('"' + $root + '\caddy.exe" run --config "' + $root + '\Caddyfile" --adapter caddyfile >> "C:\MoinTaraz\logs\caddy.log" 2>&1')
    Start-Sleep -Seconds 5
}
'@
[IO.File]::WriteAllText((Join-Path $Root 'scripts\run-caddy.ps1'), $runner, (New-Object Text.UTF8Encoding($true)))
$act = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -ExecutionPolicy Bypass -File "' + (Join-Path $Root 'scripts\run-caddy.ps1') + '"')
$trg = New-ScheduledTaskTrigger -AtStartup
$set = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$pr = New-ScheduledTaskPrincipal -UserId 'NT AUTHORITY\LOCAL SERVICE' -LogonType ServiceAccount -RunLevel Limited
Register-ScheduledTask -TaskName 'MoinTaraz-Caddy' -Action $act -Trigger $trg -Settings $set -Principal $pr -Force | Out-Null
Stop-ScheduledTask -TaskName 'MoinTaraz-Caddy' -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process -Filter "Name='caddy.exe'" | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-ScheduledTask -TaskName 'MoinTaraz-Caddy'

Write-Host '[5/5] Telling the application it is behind HTTPS, then restarting it...'
Set-EnvValue 'TRUST_PROXY' '1'
Set-EnvValue 'HTTPS_ONLY' '1'
Set-EnvValue 'PUBLIC_DOMAIN' $Domain
Stop-MoinApp; Start-MoinApp
Start-Sleep -Seconds 20
Write-Host ''
Write-Host "Open  https://$Domain  in a browser (the first load can take up to a minute while the certificate is issued)."
Write-Host 'If it does not open: check that DNS points here and that ports 80/443 are open at the provider; log: C:\MoinTaraz\logs\caddy.log'
