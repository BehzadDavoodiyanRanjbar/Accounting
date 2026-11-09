# Turns free sign-up on or off.   .\set-registration.ps1 on     or     .\set-registration.ps1 off
# Optional:  -Approval manual  (default: the manager approves after the e-mail is confirmed)   or   -Approval auto  (active right after e-mail confirmation)
# Sign-up needs working e-mail: run .\set-smtp.ps1 first.
param([Parameter(Mandatory = $true)][ValidateSet('on', 'off')][string]$State, [ValidateSet('manual', 'auto')][string]$Approval)
. "$PSScriptRoot\common.ps1"
Assert-Admin
Set-EnvValue 'ALLOW_REGISTRATION' $(if ($State -eq 'on') { '1' } else { '0' })
if ($Approval) { Set-EnvValue 'REG_AUTO_APPROVE' $(if ($Approval -eq 'auto') { '1' } else { '0' }) }
if ($State -eq 'on' -and -not (Read-EnvFile)['SMTP_HOST']) { Write-Host 'WARNING: e-mail (SMTP) is not set up yet - sign-up stays closed until you run .\set-smtp.ps1' }
Stop-MoinApp; Start-MoinApp
if (Wait-Health 90) { "Free sign-up is now: $State" } else { 'Application did not answer; see C:\MoinTaraz\logs\app.log' }
