@echo off
:: Self-elevate to Administrator to remove remaining Start Menu & Registry traces
net session >nul 2>&1
if %errorlevel% neq 0 (
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo ========================================================
echo       Legacy XAMPP System Cleanup (Admin)
echo ========================================================

echo [1/2] Removing legacy Start Menu shortcuts...
if exist "C:\ProgramData\Microsoft\Windows\Start Menu\Programs\XAMPP" (
    rmdir /s /q "C:\ProgramData\Microsoft\Windows\Start Menu\Programs\XAMPP"
    echo   - Start Menu folder removed.
) else (
    echo   - Start Menu folder already clean.
)

echo [2/2] Removing legacy Add/Remove Programs registry keys...
reg delete "HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall\xampp" /f >nul 2>&1
reg delete "HKLM\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\xampp" /f >nul 2>&1
echo   - Registry keys removed.

echo ========================================================
echo Complete! All legacy XAMPP entries removed from system.
echo ========================================================
pause
