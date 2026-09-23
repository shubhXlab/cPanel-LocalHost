@echo off
title Building Single-File cPanel-Localhost.exe...
echo ========================================================
echo   Building True Single-File cPanel-Localhost.exe
echo ========================================================
echo.

node scripts\build_single_exe.js

if %ERRORLEVEL% equ 0 (
    echo.
    echo ========================================================
    echo [SUCCESS] cPanel-Localhost.exe built successfully!
    echo ========================================================
) else (
    echo.
    echo [ERROR] Build failed with error code %ERRORLEVEL%
)

pause
