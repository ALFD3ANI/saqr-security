@echo off
echo ============================================
echo  Saqr Security - Railway Deployment Script
echo ============================================
echo.
echo Step 1: Login to Railway (browser will open)...
cd /d "%~dp0"
call railway login
if %errorlevel% neq 0 (
    echo LOGIN FAILED. Exiting.
    pause
    exit /b 1
)

echo.
echo Step 2: Deploying Backend...
cd "%~dp0backend"
call railway up --detach
if %errorlevel% neq 0 (
    echo BACKEND DEPLOY FAILED.
    pause
    exit /b 1
)

echo.
echo Step 3: Deploying Frontend...
cd "%~dp0frontend"
call railway up --detach
if %errorlevel% neq 0 (
    echo FRONTEND DEPLOY FAILED.
    pause
    exit /b 1
)

echo.
echo ============================================
echo  DONE! Both services deployed successfully.
echo ============================================
pause
