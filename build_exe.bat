@echo off
title Building cPanel.exe...
echo ========================================================
echo       Building Zero-Terminal cPanel.exe Launcher
echo ========================================================
echo.

set CSC="C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"

if not exist %CSC% (
    echo [ERROR] C# Compiler not found at %CSC%
    pause
    exit /b 1
)

echo Compiling launcher\cPanelLauncher.cs into cPanel.exe ...
%CSC% /nologo /target:winexe /out:cPanel.exe /r:System.dll /r:System.Windows.Forms.dll /r:System.Drawing.dll launcher\cPanelLauncher.cs

if %ERRORLEVEL% equ 0 (
    echo.
    echo ========================================================
    echo [SUCCESS] cPanel.exe built successfully!
    echo Double-click cPanel.exe to launch with zero terminal windows.
    echo ========================================================
) else (
    echo.
    echo [ERROR] Compilation failed with error code %ERRORLEVEL%
)

pause
