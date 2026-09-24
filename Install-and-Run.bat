@echo off
setlocal EnableDelayedExpansion
title cPanel-Localhost

:: ─────────────────────────────────────────────────────────────────────────────
:: Self-elevate to Administrator (needed for cert install + Defender exclusion)
:: ─────────────────────────────────────────────────────────────────────────────
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting administrator access...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

cd /D "%~dp0"

cls
echo.
echo  ============================================================
echo    cPanel-Localhost  ^|  Starting up...
echo  ============================================================
echo.

:: ─────────────────────────────────────────────────────────────────────────────
:: Install certificate (skip if already in store)
:: ─────────────────────────────────────────────────────────────────────────────
set "CERT=%~dp0scripts\cpanel-localhost-cert.cer"
if exist "%CERT%" (
    echo  [1/3] Checking trust certificate...
    certutil -store Root "FF64655A59292186DB955542DC9D1C16855442E0" >nul 2>&1
    if !errorLevel! neq 0 (
        certutil -addstore -f "ROOT" "%CERT%" >nul 2>&1
        certutil -addstore -f "TrustedPublisher" "%CERT%" >nul 2>&1
        echo         Certificate installed as trusted.
    ) else (
        echo         Already trusted - OK
    )
) else (
    echo  [1/3] Certificate file not found - skipping
)

:: ─────────────────────────────────────────────────────────────────────────────
:: Add Windows Defender exclusion for this folder
:: ─────────────────────────────────────────────────────────────────────────────
echo  [2/3] Setting up Windows Defender exclusion...
powershell -NoProfile -Command "Add-MpPreference -ExclusionPath '%~dp0' -ErrorAction SilentlyContinue" >nul 2>&1
echo         Done.

:: ─────────────────────────────────────────────────────────────────────────────
:: Find Node.js
:: ─────────────────────────────────────────────────────────────────────────────
echo  [3/3] Starting cPanel server...
set "NODE=node"
where node >nul 2>&1
if %errorLevel% neq 0 (
    if exist "C:\Program Files\nodejs\node.exe" (
        set "NODE=C:\Program Files\nodejs\node.exe"
    ) else (
        echo.
        echo  ERROR: Node.js not found. Install from https://nodejs.org
        pause
        exit /b 1
    )
)

:: Kill any old server on port 2083
for /f "tokens=5" %%P in ('netstat -ano 2^>nul ^| findstr /C:":2083 "') do (
    taskkill /PID %%P /F >nul 2>&1
)
timeout /t 1 /nobreak >nul

:: Start the server (keep the window open so server keeps running)
echo.
echo  ============================================================
echo    Starting server... browser will open automatically.
echo    Keep this window open while using cPanel-Localhost.
echo  ============================================================
echo.

:: Start Node in this same window (so it keeps running)
:: Open browser in background after 6 seconds
start /b cmd /c "timeout /t 6 /nobreak >nul && start "" http://localhost:2083"

"%NODE%" "%~dp0server\server.js" --autostart

echo.
echo  Server stopped.
pause
endlocal
