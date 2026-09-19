@echo off
title WENKER Router - Local AI Proxy Gateway
color 0b
echo ============================================================
echo   WENKER Router - Local AI Proxy Gateway v2.0
echo   Supports over 180 AI providers and free models on WENKER Cloud.
echo ============================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js has not been installed on the system!
    echo Please download and install Node.js from: https://nodejs.org/
    pause
    exit /b
)

echo [INFO] Starting WENKER Router server on port 3600...
echo [INFO] Opening browser at: http://localhost:3600
start http://localhost:3600

node server/index.js
pause
