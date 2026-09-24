# cPanel-Localhost - Setup Script (Self-Elevating)
# This script installs the signing certificate and sets up the app for trusted execution

param([switch]$Elevated)

function Test-Admin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]$identity
    $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Self-elevate if not admin
if (-not (Test-Admin)) {
    $scriptPath = $MyInvocation.MyCommand.Path
    Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -Elevated" -Wait
    exit
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$certFile  = Join-Path $scriptDir "scripts\cpanel-localhost-cert.cer"
$exeFile   = Join-Path $scriptDir "cPanel-Localhost.exe"

Write-Host ""
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host "   cPanel-Localhost - Trusted Setup" -ForegroundColor Cyan
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Install certificate to machine stores
Write-Host "  [1/4] Installing trusted root certificate..." -ForegroundColor Yellow
try {
    $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($certFile)

    # Install to LocalMachine\Root
    $rootStore = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "LocalMachine")
    $rootStore.Open("ReadWrite")
    $rootStore.Add($cert)
    $rootStore.Close()

    # Install to LocalMachine\TrustedPublisher
    $tpStore = New-Object System.Security.Cryptography.X509Certificates.X509Store("TrustedPublisher", "LocalMachine")
    $tpStore.Open("ReadWrite")
    $tpStore.Add($cert)
    $tpStore.Close()

    Write-Host "        Certificate installed to Trusted Root + Trusted Publisher!" -ForegroundColor Green
} catch {
    Write-Host "        Warning: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 2: Sign the exe using the installed cert
Write-Host "  [2/4] Signing cPanel-Localhost.exe..." -ForegroundColor Yellow
try {
    $signingCert = Get-Item "Cert:\CurrentUser\My\FF64655A59292186DB955542DC9D1C16855442E0" -ErrorAction SilentlyContinue
    if (-not $signingCert) {
        # Try LocalMachine
        $signingCert = Get-Item "Cert:\LocalMachine\My\FF64655A59292186DB955542DC9D1C16855442E0" -ErrorAction SilentlyContinue
    }
    if ($signingCert) {
        $result = Set-AuthenticodeSignature -FilePath $exeFile -Certificate $signingCert -HashAlgorithm SHA256 -TimestampServer "http://timestamp.comodoca.com/authenticode"
        Write-Host "        Signed! Status: $($result.Status)" -ForegroundColor Green
    } else {
        Write-Host "        Signing cert not found in store - skipping" -ForegroundColor Yellow
    }
} catch {
    Write-Host "        Could not sign: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Step 3: Unblock and add Defender exclusion
Write-Host "  [3/4] Unblocking executable and adding Defender exclusion..." -ForegroundColor Yellow
Unblock-File -Path $exeFile -ErrorAction SilentlyContinue
Add-MpPreference -ExclusionPath $exeFile -ErrorAction SilentlyContinue
Add-MpPreference -ExclusionPath $scriptDir -ErrorAction SilentlyContinue
Write-Host "        Done!" -ForegroundColor Green

# Step 4: Verify and launch
Write-Host "  [4/4] Verifying setup..." -ForegroundColor Yellow
$sig = Get-AuthenticodeSignature $exeFile
Write-Host "        Signature Status: $($sig.Status)" -ForegroundColor $(if($sig.Status -eq "Valid") {"Green"} else {"Yellow"})
Write-Host "        Signer: $($sig.SignerCertificate.Subject)" -ForegroundColor Gray

Write-Host ""
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host "   Setup Complete! You can now run the exe   " -ForegroundColor Green
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Launching cPanel-Localhost..." -ForegroundColor White
Start-Process $exeFile
Start-Sleep -Seconds 2
