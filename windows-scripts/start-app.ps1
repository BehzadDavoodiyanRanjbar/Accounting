. "$PSScriptRoot\common.ps1"
Assert-Admin
Stop-MoinApp
Start-MoinApp
if (Wait-Health 90) { 'Application is running.' } else { 'Application did not answer; see C:\MoinTaraz\logs\app.log' }
