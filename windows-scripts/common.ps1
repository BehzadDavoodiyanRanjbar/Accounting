# Shared helpers (dot-sourced by the other scripts). Do not run directly.
$ErrorActionPreference = 'Stop'
$Root = 'C:\MoinTaraz'
$EnvFile = Join-Path $Root 'config\app.env'

function Assert-Admin {
    $p = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Please run PowerShell as Administrator (right-click PowerShell -> Run as administrator).'
    }
}
function Read-EnvFile([string]$file = $EnvFile) {
    $h = @{}
    if (Test-Path $file) {
        foreach ($line in Get-Content -LiteralPath $file -Encoding UTF8) {
            $t = $line.Trim()
            if ($t -eq '' -or $t.StartsWith('#')) { continue }
            $i = $t.IndexOf('=')
            if ($i -gt 0) { $h[$t.Substring(0, $i).Trim()] = $t.Substring($i + 1).Trim() }
        }
    }
    return $h
}
function Set-EnvValue([string]$key, [string]$value) {
    $lines = @()
    if (Test-Path $EnvFile) { $lines = @(Get-Content -LiteralPath $EnvFile -Encoding UTF8) }
    $found = $false
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match ('^\s*' + [regex]::Escape($key) + '\s*=')) { $lines[$i] = "$key=$value"; $found = $true }
    }
    if (-not $found) { $lines += "$key=$value" }
    [IO.File]::WriteAllLines($EnvFile, [string[]]$lines, (New-Object Text.UTF8Encoding($false)))
}
function Import-EnvToProcess {
    $h = Read-EnvFile
    foreach ($k in $h.Keys) { Set-Item -Path ("Env:" + $k) -Value $h[$k] }
    return $h
}
function New-RandomSecret([int]$len = 24) {
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'.ToCharArray()
    $bytes = New-Object byte[] $len
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create(); $rng.GetBytes($bytes)
    $s = ''; foreach ($b in $bytes) { $s += $chars[$b % $chars.Length] }
    # guarantee upper, lower and digit (SQL Server password policy)
    return 'Aa7' + $s
}
function New-HexKey([int]$bytes = 32) {
    $b = New-Object byte[] $bytes
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create(); $rng.GetBytes($b)
    return (($b | ForEach-Object { $_.ToString('x2') }) -join '')
}
function Stop-MoinApp {
    $t = Get-ScheduledTask -TaskName 'MoinTaraz-App' -ErrorAction SilentlyContinue
    if ($t) { Stop-ScheduledTask -TaskName 'MoinTaraz-App' -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 2
    Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*MoinTaraz\app*' -or $_.CommandLine -like '*server.js*' } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 1
}
function Start-MoinApp { Start-ScheduledTask -TaskName 'MoinTaraz-App' }
function Wait-Health([int]$seconds = 90) {
    $end = (Get-Date).AddSeconds($seconds)
    while ((Get-Date) -lt $end) {
        try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/health' -UseBasicParsing -TimeoutSec 5; if ($r.StatusCode -eq 200) { return $true } } catch { }
        Start-Sleep -Seconds 3
    }
    return $false
}
function Invoke-SqlCmdText([string]$server, [string]$query, [string]$db = 'master', [string]$user, [string]$pass) {
    $a = @('-S', $server, '-d', $db, '-b', '-C', '-Q', $query)
    if ($user) { $env:SQLCMDPASSWORD = $pass; $a += @('-U', $user) } else { $a += '-E' }
    $out = & sqlcmd @a 2>&1
    if ($LASTEXITCODE -ne 0) { throw ("sqlcmd failed: " + ($out -join "`n")) }
    Remove-Item Env:\SQLCMDPASSWORD -ErrorAction SilentlyContinue
    return $out
}

function Install-NpmPackages([string]$dir) {
    # Installs the application packages with retries (unstable networks) and a fallback mirror. PostgreSQL driver is optional on the server.
    $hashFile = Join-Path $dir 'node_modules\.moin-pkg-hash'
    $cur = (Get-FileHash -LiteralPath (Join-Path $dir 'package.json') -Algorithm SHA256).Hash
    if ((Test-Path (Join-Path $dir 'node_modules\mssql\package.json')) -and (Test-Path (Join-Path $dir 'node_modules\tedious\package.json'))) {
        if (-not (Test-Path $hashFile)) { Set-Content -Path $hashFile -Value $cur; Write-Host '   Ready-made packages found (node_modules); skipping download.'; return $true }
        if ((Get-Content $hashFile -ErrorAction SilentlyContinue) -eq $cur) { Write-Host '   Packages already installed and up to date.'; return $true }
    }
    Push-Location $dir
    try {
        & npm config set fetch-retries 6 | Out-Null
        & npm config set fetch-retry-mintimeout 5000 | Out-Null
        & npm config set fetch-retry-maxtimeout 60000 | Out-Null
        & npm config set fetch-timeout 120000 | Out-Null
        $registries = @('https://registry.npmjs.org/', 'https://registry.npmmirror.com/')
        foreach ($reg in $registries) {
            for ($i = 1; $i -le 3; $i++) {
                Write-Host ("   npm install attempt $i ($reg)")
                & npm install --omit=dev --omit=optional --no-audit --no-fund --registry $reg | Out-Host
                if ($LASTEXITCODE -eq 0 -and (Test-Path (Join-Path $dir 'node_modules\mssql'))) { Set-Content -Path $hashFile -Value $cur; return $true }
                Start-Sleep -Seconds 5
            }
        }
        return $false
    } finally { Pop-Location }
}
