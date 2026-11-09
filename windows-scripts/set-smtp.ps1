# Sets up the e-mail (SMTP) used to confirm sign-ups, then sends a test message.   .\set-smtp.ps1
# The password is typed hidden and is saved only in C:\MoinTaraz\config\app.env (never type it in a chat).
. "$PSScriptRoot\common.ps1"
Assert-Admin
$h = Read-EnvFile
function Ask([string]$label, [string]$def) {
    $q = $label; if ($def) { $q += " [$def]" }
    $v = Read-Host $q; if (-not $v) { $v = $def }; return $v.Trim()
}
$smtpHost = Ask 'SMTP server name (example: mail.yourdomain.ir)' $h['SMTP_HOST']
$defPort = '587'; if ($h['SMTP_PORT']) { $defPort = $h['SMTP_PORT'] }
$port = Ask 'SMTP port (465 = SSL, 587 = STARTTLS)' $defPort
$user = Ask 'SMTP user name (usually the full e-mail address; empty if the server needs no login)' $h['SMTP_USER']
$pw = ''
if ($user) {
    $sec = Read-Host 'SMTP password (hidden; press Enter to keep the old one)' -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    try { $pw = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    if (-not $pw) { $pw = $h['SMTP_PASS'] }
}
$defFrom = $h['SMTP_FROM']; if (-not $defFrom) { $defFrom = $user }
$from = Ask 'Sender address shown to people (example: noreply@yourdomain.ir)' $defFrom
$defUrl = $h['PUBLIC_URL']; if (-not $defUrl) { $defUrl = 'http://85.198.54.206:3200' }
$url = Ask 'Public address of the site used in the confirmation link (https://yourdomain.ir when the domain works)' $defUrl
if (-not $smtpHost -or -not $from) { throw 'Server name and sender address are required.' }
Set-EnvValue 'SMTP_HOST' $smtpHost
Set-EnvValue 'SMTP_PORT' $port
Set-EnvValue 'SMTP_SECURE' $(if ($port -eq '465') { '1' } else { '0' })
Set-EnvValue 'SMTP_USER' $user
Set-EnvValue 'SMTP_PASS' $pw
Set-EnvValue 'SMTP_FROM' $from
Set-EnvValue 'SMTP_FROM_NAME' 'Moin Taraz'
Set-EnvValue 'PUBLIC_URL' $url.TrimEnd('/')
Write-Host 'Saved. Restarting the application ...'
Stop-MoinApp; Start-MoinApp
if (-not (Wait-Health 90)) { Write-Host 'The application did not answer; see C:\MoinTaraz\logs\app.log'; exit 1 }
$to = Read-Host 'Send a test e-mail to which address? (Enter to skip)'
if ($to) { & "$PSScriptRoot\test-email.ps1" -To $to }
