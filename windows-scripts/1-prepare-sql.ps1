# Step 1: prepares SQL Server (TCP, mixed-mode login, memory limit), creates the databases and the application login.
# Run as Administrator.  Safe to run again.
param([int]$MaxMemoryMB = 3072)
. "$PSScriptRoot\common.ps1"
Assert-Admin
foreach ($d in 'config','logs','backups','sqlbackups','incoming','scripts','caddy') { New-Item -ItemType Directory -Force -Path (Join-Path $Root $d) | Out-Null }
if (-not (Get-Command sqlcmd -ErrorAction SilentlyContinue)) { throw 'sqlcmd was not found. Install "SQL Server command line utilities" or open a NEW PowerShell window and retry.' }
try { Set-TimeZone -Id 'Iran Standard Time' } catch { Write-Host 'Could not set time zone (continuing).' }

Write-Host '[1/6] Checking SQL Server (shared memory)...'
$ver = Invoke-SqlCmdText '.' 'SELECT CAST(SERVERPROPERTY(''Edition'') AS nvarchar(100)) + '' | '' + CAST(SERVERPROPERTY(''ProductVersion'') AS nvarchar(50))'
$ver | Select-Object -Skip 2 -First 1 | ForEach-Object { Write-Host ("      " + $_.Trim()) }

Write-Host '[2/6] Enabling SQL login (mixed mode) and TCP/IP on port 1433...'
Invoke-SqlCmdText '.' "EXEC xp_instance_regwrite N'HKEY_LOCAL_MACHINE', N'Software\Microsoft\MSSQLServer\MSSQLServer', N'LoginMode', REG_DWORD, 2" | Out-Null
$k = Get-ChildItem 'HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server' | Where-Object { $_.PSChildName -match '^MSSQL\d+\.MSSQLSERVER$' } | Select-Object -First 1
if (-not $k) { throw 'Default SQL Server instance (MSSQLSERVER) registry key not found. This script supports the default instance only.' }
$tcp = Join-Path $k.PSPath 'MSSQLServer\SuperSocketNetLib\Tcp'
Set-ItemProperty -Path $tcp -Name Enabled -Value 1
Set-ItemProperty -Path (Join-Path $tcp 'IPAll') -Name TcpPort -Value '1433'
Set-ItemProperty -Path (Join-Path $tcp 'IPAll') -Name TcpDynamicPorts -Value ''

Write-Host ('[3/6] Limiting SQL Server memory to ' + $MaxMemoryMB + ' MB and restarting the SQL service...')
Invoke-SqlCmdText '.' ("EXEC sp_configure 'show advanced options',1; RECONFIGURE; EXEC sp_configure 'max server memory (MB)'," + $MaxMemoryMB + "; RECONFIGURE;") | Out-Null
Restart-Service MSSQLSERVER -Force
Start-Sleep -Seconds 8

Write-Host '[4/6] Creating databases and the application login...'
$h = Read-EnvFile
$pw = $h['MSSQL_PASSWORD']; if (-not $pw) { $pw = New-RandomSecret 24 }
$sql = @"
IF DB_ID(N'MoinTaraz') IS NULL CREATE DATABASE [MoinTaraz];
IF DB_ID(N'MoinTarazTest') IS NULL CREATE DATABASE [MoinTarazTest];
ALTER DATABASE [MoinTaraz] SET RECOVERY FULL;
ALTER DATABASE [MoinTarazTest] SET RECOVERY SIMPLE;
IF SUSER_ID(N'moin_app') IS NULL CREATE LOGIN [moin_app] WITH PASSWORD = N'$pw', CHECK_POLICY = ON, CHECK_EXPIRATION = OFF, DEFAULT_DATABASE = [MoinTaraz]
ELSE ALTER LOGIN [moin_app] WITH PASSWORD = N'$pw';
"@
$tmp = Join-Path $env:TEMP 'moin_prep1.sql'
[IO.File]::WriteAllText($tmp, $sql, (New-Object Text.UTF8Encoding($false)))
& sqlcmd -S tcp:127.0.0.1,1433 -E -C -b -i $tmp; if ($LASTEXITCODE -ne 0) { Remove-Item $tmp -Force; throw 'Creating databases/login failed.' }
Remove-Item $tmp -Force
foreach ($db in 'MoinTaraz','MoinTarazTest') {
    $q = "IF USER_ID(N'moin_app') IS NULL CREATE USER [moin_app] FOR LOGIN [moin_app]; ALTER ROLE db_owner ADD MEMBER [moin_app];"
    Invoke-SqlCmdText 'tcp:127.0.0.1,1433' $q $db | Out-Null
}

Write-Host '[5/6] Saving settings to C:\MoinTaraz\config\app.env ...'
if (-not (Test-Path $EnvFile)) { New-Item -ItemType File -Force -Path $EnvFile | Out-Null }
Set-EnvValue 'DB_TYPE' 'mssql'
Set-EnvValue 'MSSQL_SERVER' '127.0.0.1'
Set-EnvValue 'MSSQL_PORT' '1433'
Set-EnvValue 'MSSQL_DATABASE' 'MoinTaraz'
Set-EnvValue 'MSSQL_USER' 'moin_app'
Set-EnvValue 'MSSQL_PASSWORD' $pw
Set-EnvValue 'MSSQL_ENCRYPT' 'true'
Set-EnvValue 'MSSQL_TRUST_CERT' 'true'

Write-Host '[6/6] Testing the login over TCP...'
Invoke-SqlCmdText 'tcp:127.0.0.1,1433' 'SELECT DB_NAME() AS db, SUSER_NAME() AS login_name' 'MoinTaraz' 'moin_app' $pw | Out-Null
Write-Host ''
Write-Host 'SQL Server is ready. Port 1433 is used only on this machine (do NOT open it in the firewall).'
Write-Host 'Next: run 2-install-app.ps1'
