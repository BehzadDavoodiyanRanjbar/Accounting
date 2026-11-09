# Closes the temporary test port opened by open-test-port.ps1.
param([int]$Port = 3200)
$ErrorActionPreference = 'Stop'
$p = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Run PowerShell as Administrator.' }
& netsh interface portproxy delete v4tov4 listenport=$Port listenaddress=0.0.0.0 2>$null | Out-Null
Get-NetFirewallRule -DisplayName "MoinTaraz-Test-$Port" -ErrorAction SilentlyContinue | Remove-NetFirewallRule
Write-Host "Port $Port is closed. Current forwardings:"
& netsh interface portproxy show v4tov4
