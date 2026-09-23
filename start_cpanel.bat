@echo off
title cPanel Localhost (XAMPP Edition)
echo ===================================================================
echo               cPanel Localhost (Integrated with XAMPP)
echo ===================================================================
echo Starting server on http://localhost:2083 ...
cd /D "%~dp0"
node server/server.js
pause
