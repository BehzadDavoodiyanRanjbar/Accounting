# Installs the OCR engine (Tesseract) needed by the "scan documents" pages.
# Run once on the Windows Server:  PowerShell (Run as administrator) ->
#   cd C:\MoinTaraz\scripts
#   .\install-ocr.ps1
# If the server has no access to GitHub, download the installer on any computer:
#   https://github.com/UB-Mannheim/tesseract/wiki   (file: tesseract-ocr-w64-setup-....exe)
# copy it to the server and run:   .\install-ocr.ps1 -Installer C:\MoinTaraz\incoming\tesseract-ocr-w64-setup-5.4.0.20240606.exe
param([string]$Installer = '')
$ErrorActionPreference = 'Stop'
$p = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Please run PowerShell as Administrator.' }
$exe = 'C:\Program Files\Tesseract-OCR\tesseract.exe'
function Test-Tess { Test-Path $exe }

if (Test-Tess) {
    Write-Host "Tesseract is already installed: $exe"
} else {
    if (-not $Installer) {
        $Installer = Join-Path $env:TEMP 'tesseract-setup.exe'
        $urls = @(
            'https://github.com/UB-Mannheim/tesseract/releases/download/v5.4.0.20240606/tesseract-ocr-w64-setup-5.4.0.20240606.exe',
            'https://digi.bib.uni-mannheim.de/tesseract/tesseract-ocr-w64-setup-5.4.0.20240606.exe'
        )
        $got = $false
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        foreach ($u in $urls) {
            try { Write-Host "Downloading $u ..."; Invoke-WebRequest -Uri $u -OutFile $Installer -UseBasicParsing; if ((Get-Item $Installer).Length -gt 20MB) { $got = $true; break } } catch { Write-Host "  failed: $($_.Exception.Message)" }
        }
        if (-not $got -and (Get-Command winget -ErrorAction SilentlyContinue)) {
            Write-Host 'Trying winget...'
            winget install --id UB-Mannheim.TesseractOCR --exact --silent --accept-package-agreements --accept-source-agreements
            $Installer = ''
        } elseif (-not $got) {
            throw 'Could not download Tesseract. Download tesseract-ocr-w64-setup-....exe on another computer (https://github.com/UB-Mannheim/tesseract/wiki), copy it to this server and run:  .\install-ocr.ps1 -Installer <path-to-exe>'
        }
    }
    if ($Installer) {
        if (-not (Test-Path $Installer)) { throw "Installer not found: $Installer" }
        Write-Host 'Installing Tesseract (silent)...'
        $pr = Start-Process -FilePath $Installer -ArgumentList '/S' -Wait -PassThru
        if ($pr.ExitCode -ne 0) { throw "Installer exit code $($pr.ExitCode)" }
    }
}
if (-not (Test-Tess)) {
    $alt = Get-ChildItem 'C:\Program Files','C:\Program Files (x86)' -Recurse -Filter tesseract.exe -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($alt) { $exe = $alt.FullName; Write-Host "Found: $exe  (set TESSERACT_PATH=$exe in C:\MoinTaraz\config\app.env)" } else { throw 'tesseract.exe was not found after install.' }
}
& $exe --version 2>&1 | Select-Object -First 1
Write-Host ''
Write-Host 'OK. Persian/English language data ship with the application (app\tessdata), nothing else to install.'
Write-Host 'Now press Ctrl+F5 in the browser and scan a document. (No restart needed; if the page still says OCR is missing, run: C:\MoinTaraz\scripts\stop-app.ps1 then start-app.ps1)'
