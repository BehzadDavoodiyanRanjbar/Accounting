# Installs a new version of the web interface (the "v2" folder built on the Docker computer).
# Usage:  .\update-ui.ps1 -Zip C:\MoinTaraz\incoming\v2.zip
# It does NOT touch the database or the program files, and needs no restart.
# The previous interface is kept in C:\MoinTaraz\app\public\v2-prev (restored automatically if the copy fails).
param([Parameter(Mandatory = $true)][string]$Zip)
. "$PSScriptRoot\common.ps1"
Assert-Admin
if (-not (Test-Path $Zip)) { throw "File not found: $Zip" }
$tmp = Join-Path $Root 'incoming\_ui'
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
Write-Host '[1/5] Unpacking...'
Expand-Archive -LiteralPath $Zip -DestinationPath $tmp -Force
$idx = Get-ChildItem $tmp -Recurse -Filter 'index.html' | Where-Object { Test-Path (Join-Path $_.Directory.FullName 'assets') } | Select-Object -First 1
if (-not $idx) { throw 'The zip does not contain a built interface (index.html + assets). Wrong file.' }
$src = $idx.Directory.FullName
$dst = Join-Path $Root 'app\public\v2'
$prev = Join-Path $Root 'app\public\v2-prev'
Write-Host '[2/5] Saving a copy of the current interface...'
if (Test-Path $prev) { Remove-Item $prev -Recurse -Force }
if (Test-Path $dst) { & robocopy $dst $prev /E /NFL /NDL /NJH /NJS /NP | Out-Null }
Write-Host '[3/5] Installing the new interface...'
& robocopy $src $dst /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) {
    Write-Host 'Copy failed. Restoring the previous interface...'
    if (Test-Path $prev) { & robocopy $prev $dst /MIR /NFL /NDL /NJH /NJS /NP | Out-Null }
    throw 'Copy failed - the previous interface was restored.'
}
Write-Host '[4/5] Checking...'
$js = Get-ChildItem (Join-Path $dst 'assets') -Filter '*.js' -ErrorAction SilentlyContinue
if (-not $js) { throw 'No script files found in the new interface.' }
$stamp = ($js | Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime
Write-Host ("    files: {0} | newest file: {1}" -f $js.Count, $stamp)
if (Wait-Health 30) { Write-Host '[5/5] Done. The application is running. Press Ctrl+F5 in the browser.' }
else { Write-Host '[5/5] Files installed, but the application did not answer. Run C:\MoinTaraz\scripts\start-app.ps1 then status.ps1' }
Remove-Item $tmp -Recurse -Force
