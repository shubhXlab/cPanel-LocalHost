@echo off
setlocal EnableDelayedExpansion
title cPanel-LocalHost — First-Run Setup

:: ─────────────────────────────────────────────────────────────────────────────
:: STEP 0 ─ Self-elevate to Administrator if not already running elevated
:: ─────────────────────────────────────────────────────────────────────────────
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting administrator privileges...
    powershell -NoProfile -Command ^
        "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

:: ─────────────────────────────────────────────────────────────────────────────
:: STEP 1 ─ Resolve paths relative to this batch file's location
:: ─────────────────────────────────────────────────────────────────────────────
cd /D "%~dp0"
set "CERT_FILE=%~dp0scripts\cpanel-localhost-cert.cer"
set "EXE_FILE=%~dp0cPanel-Localhost.exe"

cls
echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║        cPanel-LocalHost  ─  First-Run Setup         ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

:: ─────────────────────────────────────────────────────────────────────────────
:: STEP 2 ─ Verify required files exist
:: ─────────────────────────────────────────────────────────────────────────────
if not exist "%CERT_FILE%" (
    echo  [ERROR] Certificate not found:
    echo          %CERT_FILE%
    echo.
    echo  Please ensure "scripts\cpanel-localhost-cert.cer" is in the same
    echo  folder as this batch file, then run again.
    echo.
    pause
    exit /b 1
)

if not exist "%EXE_FILE%" (
    echo  [ERROR] Executable not found:
    echo          %EXE_FILE%
    echo.
    echo  Please ensure "cPanel-Localhost.exe" is in the same folder as
    echo  this batch file, then run again.
    echo.
    pause
    exit /b 1
)

:: ─────────────────────────────────────────────────────────────────────────────
:: STEP 3 ─ Check if cert is already installed (skip if already trusted)
:: ─────────────────────────────────────────────────────────────────────────────
echo  [1/2] Checking SSL certificate...

set "CERT_THUMBPRINT="
for /f "tokens=*" %%T in ('powershell -NoProfile -Command ^
    "$c = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2 '%CERT_FILE%';" ^
    "Write-Output $c.Thumbprint"') do set "CERT_THUMBPRINT=%%T"

powershell -NoProfile -Command ^
    "$store = New-Object System.Security.Cryptography.X509Certificates.X509Store('Root','LocalMachine');" ^
    "$store.Open('ReadOnly');" ^
    "$found = $store.Certificates | Where-Object { $_.Thumbprint -eq '%CERT_THUMBPRINT%' };" ^
    "$store.Close();" ^
    "if ($found) { exit 0 } else { exit 1 }" >nul 2>&1

if %errorLevel% equ 0 (
    echo  [1/2] Certificate already trusted — skipping installation.
) else (
    echo  [1/2] Installing SSL certificate to Trusted Root store...
    certutil -addstore -f "ROOT" "%CERT_FILE%" >nul 2>&1
    if !errorLevel! neq 0 (
        echo.
        echo  [ERROR] Certificate installation failed.
        echo          Make sure you clicked "Yes" on the UAC prompt.
        echo.
        pause
        exit /b 1
    )
    echo  [1/2] Certificate installed successfully!
)

:: ─────────────────────────────────────────────────────────────────────────────
:: STEP 4 ─ Launch cPanel-Localhost.exe
:: ─────────────────────────────────────────────────────────────────────────────
echo.
echo  [2/2] Launching cPanel-LocalHost...
echo.
echo  ┌──────────────────────────────────────────────────────┐
echo  │  Dashboard will open at:  http://localhost:2083      │
echo  │  This window can be closed once the browser opens.   │
echo  └──────────────────────────────────────────────────────┘
echo.

:: Small delay so the user can read the message
timeout /t 2 /nobreak >nul

start "" "%EXE_FILE%"

:: ─────────────────────────────────────────────────────────────────────────────
:: STEP 5 ─ Open browser after a brief startup delay
:: ─────────────────────────────────────────────────────────────────────────────
timeout /t 4 /nobreak >nul
start "" "http://localhost:2083"

endlocal
exit /b 0
