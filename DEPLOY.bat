@echo off
title Saqr Security - Deploy to Railway
color 0A
echo.
echo  =====================================================
echo   Saqr Security - Railway Deployment
echo  =====================================================
echo.
echo  This will deploy all backend fixes to Railway.
echo  A browser will open for Railway login - log in
echo  then come back to this window.
echo.
pause

cd /d "%~dp0"

echo.
echo [1/4] Logging in to Railway...
call railway login
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo  LOGIN FAILED. Please try again.
    pause
    exit /b 1
)
echo  Login OK.

echo.
echo [2/4] Deploying Backend...
cd "%~dp0backend"
call railway up --detach
if %errorlevel% neq 0 (
    echo  Trying to link service first...
    call railway link
    call railway up --detach
)

echo.
echo [3/4] Deploying Frontend...
cd "%~dp0frontend"
call railway up --detach
if %errorlevel% neq 0 (
    echo  Trying to link service first...
    call railway link
    call railway up --detach
)

echo.
color 0A
echo  =====================================================
echo   DONE! Deployment started on Railway.
echo   Check https://railway.app for build status.
echo  =====================================================
echo.
pause
