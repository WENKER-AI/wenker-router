@echo off
title WENKER Router - Local AI Proxy Gateway
color 0b
echo ============================================================
echo   WENKER Router - Local AI Proxy Gateway v2.0
echo   Ho tro 180+ AI Providers & WENKER Cloud Free Models
echo ============================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js chua duoc cai dat tren may!
    echo Vui long tai va cai dat Node.js tu: https://nodejs.org/
    pause
    exit /b
)

echo [INFO] Dang khoi dong may chu WENKER Router tren cong 3600...
echo [INFO] Mo trinh duyet tai: http://localhost:3600
start http://localhost:3600

node server/index.js
pause
