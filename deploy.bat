@echo off
echo ========================================
echo MTC Counter - GitHub Deployment Script
echo ========================================
echo.

REM Check if Git is installed
git --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Git is not installed!
    echo Please install Git from: https://git-scm.com/download/win
    pause
    exit /b 1
)

echo Git detected! Proceeding with deployment...
echo.

REM Initialize Git if needed
if not exist .git (
    echo Initializing Git repository...
    git init
    git branch -M main
)

REM Add remote if not exists
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo Adding GitHub remote...
    git remote add origin https://github.com/jsam316/Mtccounter.git
)

echo.
echo Staging files...
git add .

echo.
echo Creating commit...
git commit -m "Updated MTC Counter - Dark theme, New Record button, Fixed exports"

echo.
echo Pushing to GitHub...
git push -u origin main

if errorlevel 1 (
    echo.
    echo ========================================
    echo PUSH FAILED - Trying force push...
    echo ========================================
    git push -u origin main --force
)

echo.
echo ========================================
echo SUCCESS! Your site will be live at:
echo https://jsam316.github.io/Mtccounter/
echo ========================================
echo.
echo Note: It may take 1-2 minutes for GitHub Pages to update
echo.
pause
