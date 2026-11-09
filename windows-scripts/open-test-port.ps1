# Temporarily exposes the application on  http://<server-ip>:3200  (plain HTTP - for testing only, no real data!).
# Usage:   .\open-test-port.ps1 -AllowFrom 1.2.3.4          (only your own public IP can connect - recommended)
#          .\open-test-port.ps1 -Everyone                    (anyone on the internet can connect - NOT recommended)
# Undo:    .\close-test-port.ps1
param([string]$AllowFrom = '', [switch]$Everyone, [int]$Port = 3200)
$ErrorActionPreference = 'Stop'
$p = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Run PowerShell as Administrator.' }
if (-not $AllowFrom -and -not $Everyone) { throw 'Give your own public IP:  .\open-test-port.ps1 -AllowFrom 1.2.3.4   (find it by opening "what is my ip" in a browser on YOUR computer). Or use -Everyone.' }
if ($AllowFrom -and $AllowFrom -notmatch '^\d{1,3}(\.\d{1,3}){3}(/\d{1,2})?$') { throw "This does not look like an IPv4 address: $AllowFrom" }

# the application must already be running on 127.0.0.1:3000
try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/health' -UseBasicParsing -TimeoutSec 5 } catch { throw 'The application does not answer on 127.0.0.1:3000. Run status.ps1 first.' }

$svc = Get-Service iphlpsvc -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -ne 'Running') { Set-Service iphlpsvc -StartupType Automatic; Start-Service iphlpsvc }

& netsh interface portproxy delete v4tov4 listenport=$Port listenaddress=0.0.0.0 2>$null | Out-Null
& netsh interface portproxy add v4tov4 listenport=$Port listenaddress=0.0.0.0 connectport=3000 connectaddress=127.0.0.1
if ($LASTEXITCODE -ne 0) { throw 'Could not create the port forwarding.' }

$name = "MoinTaraz-Test-$Port"
Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue | Remove-NetFirewallRule
if ($Everyone) { New-NetFirewallRule -DisplayName $name -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow | Out-Null }
else { New-NetFirewallRule -DisplayName $name -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -RemoteAddress $AllowFrom | Out-Null }

Start-Sleep -Seconds 2
$t = Test-NetConnection -ComputerName 127.0.0.1 -Port $Port -WarningAction SilentlyContinue
Write-Host ''
if ($t.TcpTestSucceeded) { Write-Host "OK: port $Port forwards to the application inside this server." } else { Write-Host "WARNING: port $Port did not answer locally." }
Write-Host ("Allowed from: " + $(if ($Everyone) { 'EVERYONE (plain HTTP - do not enter real data)' } else { $AllowFrom }))
Write-Host "Open in the browser on your computer:   http://<server-ip>:$Port"
Write-Host "If it does not open from outside: also open TCP $Port in the firewall of the VPS provider's panel."
Write-Host 'Remove it later with:  .\close-test-port.ps1'
