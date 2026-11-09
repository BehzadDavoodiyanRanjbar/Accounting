# Sends a test e-mail with the settings in config\app.env.   .\test-email.ps1 -To you@example.com
param([Parameter(Mandatory = $true)][string]$To)
. "$PSScriptRoot\common.ps1"
Assert-Admin
$h = Import-EnvToProcess
$node = $env:NODE_EXE; if (-not $node) { $node = 'node' }
Push-Location (Join-Path $Root 'app')
try { & $node mail-test.js $To; $code = $LASTEXITCODE } finally { Pop-Location }
exit $code
