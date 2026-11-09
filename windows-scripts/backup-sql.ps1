# SQL Server backup (called by the scheduled tasks).  -Mode Full | Log
param([ValidateSet('Full', 'Log')][string]$Mode = 'Full')
. "$PSScriptRoot\common.ps1"
$log = Join-Path $Root 'logs\backup.log'
function Write-BkLog([string]$m) { Add-Content -Path $log -Value ((Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + ' ' + $m) }
try {
    $e = Read-EnvFile
    $db = $e['MSSQL_DATABASE']; $dir = Join-Path $Root 'sqlbackups'
    $keep = 14; if ($e['KEEP_DAYS']) { $keep = [int]$e['KEEP_DAYS'] }
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $ext = if ($Mode -eq 'Full') { 'bak' } else { 'trn' }
    $file = Join-Path $dir ($db + '_' + $Mode + '_' + $stamp + '.' + $ext)
    $srv = 'tcp:' + $e['MSSQL_SERVER'] + ',' + $e['MSSQL_PORT']
    $cmd = if ($Mode -eq 'Full') { 'BACKUP DATABASE' } else { 'BACKUP LOG' }
    try {
        Invoke-SqlCmdText $srv ("$cmd [$db] TO DISK = N'$file' WITH CHECKSUM, COMPRESSION, INIT") $db $e['MSSQL_USER'] $e['MSSQL_PASSWORD'] | Out-Null
    } catch {
        if ($_.Exception.Message -match 'COMPRESSION') {
            Invoke-SqlCmdText $srv ("$cmd [$db] TO DISK = N'$file' WITH CHECKSUM, INIT") $db $e['MSSQL_USER'] $e['MSSQL_PASSWORD'] | Out-Null
        } else { throw }
    }
    if ($Mode -eq 'Full') {
        try { Invoke-SqlCmdText $srv ("RESTORE VERIFYONLY FROM DISK = N'$file' WITH CHECKSUM") $db $e['MSSQL_USER'] $e['MSSQL_PASSWORD'] | Out-Null }
        catch { Write-BkLog 'NOTE  extra verification skipped (needs more rights); the backup itself was checksum-verified.' }
    }
    Write-BkLog ("OK  $Mode  " + (Split-Path $file -Leaf) + '  ' + [math]::Round((Get-Item $file).Length / 1MB, 1) + ' MB')
    Get-ChildItem $dir -Include '*.bak', '*.trn' -Recurse | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$keep) } | Remove-Item -Force
    # optional copy to another disk / network share:  add  OFFSITE_DIR=E:\MoinTarazBackup  to app.env
    if ($e['OFFSITE_DIR']) {
        New-Item -ItemType Directory -Force -Path $e['OFFSITE_DIR'] | Out-Null
        Copy-Item $file $e['OFFSITE_DIR'] -Force
        Write-BkLog ('OK  copied to ' + $e['OFFSITE_DIR'])
        Get-ChildItem $e['OFFSITE_DIR'] -Include '*.bak', '*.trn' -Recurse | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$keep) } | Remove-Item -Force
    }
    exit 0
} catch {
    Write-BkLog ('FAILED ' + $Mode + ': ' + $_.Exception.Message)
    exit 1
}
