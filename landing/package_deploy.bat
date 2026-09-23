@echo off
setlocal enabledelayedexpansion
title Packaging cPanel Localhost Landing Page for cPanel Deployment...

echo ===================================================================
echo     cPanel Localhost - Landing Page Deployment Packager
echo ===================================================================
echo.

cd /d "%~dp0"
set ZIP_NAME=landing-deploy.zip

if exist "%ZIP_NAME%" (
    echo [INFO] Removing existing %ZIP_NAME%...
    del "%ZIP_NAME%"
)

echo [INFO] Creating %ZIP_NAME% archive...
powershell -Command "Compress-Archive -Path 'index.html', 'style.css', 'app.js', 'config.js', '.htaccess', 'DEPLOY_TO_CPANEL.md', 'assets' -DestinationPath '%ZIP_NAME%' -Force"

if %ERRORLEVEL% equ 0 (
    echo.
    echo ===================================================================
    echo [SUCCESS] Package created successfully: %ZIP_NAME%
    echo.
    echo You can now upload '%ZIP_NAME%' directly into:
    echo    cPanel ^-^> File Manager ^-^> public_html/download/
    echo and extract it with 1-click!
    echo ===================================================================
) else (
    echo.
    echo [ERROR] Failed to create package. Error code: %ERRORLEVEL%
)

echo.
pause
