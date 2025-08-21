@echo off
title EVManager Setup - Fixed Version
echo ===============================================================
echo       EVManager - Setup (PowerShell Policy Fix)
echo ===============================================================
echo.
echo [INFO] Detected PowerShell execution policy issue
echo [INFO] Using CMD-compatible approach
echo.

echo [STEP 1] Checking Node.js...
node --version
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found - install from https://nodejs.org/
    pause
    exit /b 1
) else (
    echo [OK] Node.js found
)

echo.
echo [STEP 2] Checking npm using node...
node -e "console.log(require('child_process').execSync('npm --version', {encoding: 'utf8'}).trim())" 2>nul
if %errorlevel% neq 0 (
    echo [INFO] Trying alternative npm check...
    echo [INFO] This may indicate PowerShell execution policy issue
    echo.
    echo [SOLUTION] Run this command in PowerShell as Administrator:
    echo Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
    echo.
    pause
) else (
    echo [OK] npm working through node
)

echo.
echo [STEP 3] Checking additional requirements...
echo [INFO] Checking Python (needed for node-gyp)...
python --version >nul 2>&1 || py --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Python not found - some packages may fail to install
    echo [INFO] Install from: https://www.python.org/downloads/
    echo [INFO] Check "Add Python to PATH" during installation
    echo.
) else (
    echo [OK] Python found
)

echo [INFO] Checking Git...
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Git not found - some npm packages may need it
    echo [INFO] Install from: https://git-scm.com/download/win
    echo.
) else (
    echo [OK] Git found
)

echo.
echo [STEP 4] Creating data directories...
if not exist "data" mkdir data
if not exist "backend\data" mkdir backend\data

echo [INFO] Creating config files...
if not exist "data\proxy.txt" (
    echo # Add your proxies here, one per line > data\proxy.txt
    echo # Formats: http://user:pass@host:port >> data\proxy.txt
    echo # Example: http://user:pass@proxy.example.com:8080 >> data\proxy.txt
    echo [OK] Created data/proxy.txt
) else (
    echo [OK] data/proxy.txt exists
)

if not exist "data\wallets.txt" (
    echo # Add wallet addresses here, one per line > data\wallets.txt  
    echo # Example: 0x742d35cc6554c4532ca671b9566db5d73c91a35e >> data\wallets.txt
    echo [OK] Created data/wallets.txt
) else (
    echo [OK] data/wallets.txt exists
)

echo.
echo [STEP 5] Installing dependencies...
echo [INFO] Root project dependencies...
node -e "require('child_process').exec('npm install', (err,stdout,stderr) => { console.log(stdout); if(err) console.error(stderr); process.exit(err?1:0); })"

echo.
echo [STEP 6] Backend dependencies...
cd backend
node -e "require('child_process').exec('npm install', (err,stdout,stderr) => { console.log(stdout); if(err) console.error(stderr); process.exit(err?1:0); })"
cd ..

echo.
echo [STEP 7] Frontend dependencies...  
cd frontend
node -e "require('child_process').exec('npm install', (err,stdout,stderr) => { console.log(stdout); if(err) console.error(stderr); process.exit(err?1:0); })"
cd ..

echo.
echo [STEP 8] Installing Chrome for Puppeteer...
echo [INFO] Installing Chrome browser for web scraping...
cd backend
node -e "require('child_process').exec('npx puppeteer browsers install chrome', (err,stdout,stderr) => { console.log(stdout); if(err) console.error('Chrome install warning:', stderr); })"

echo [INFO] Checking Chrome installation...
set "chrome_ok=false"
if exist "%USERPROFILE%\.cache\puppeteer" (
    echo [OK] Puppeteer cache directory found
    set "chrome_ok=true"
) 
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    echo [OK] System Chrome found (64-bit)
    set "chrome_ok=true"
)
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    echo [OK] System Chrome found (32-bit) 
    set "chrome_ok=true"
)

if "!chrome_ok!"=="false" (
    echo [WARNING] Chrome not found!
    echo [INFO] Install Google Chrome: https://www.google.com/chrome/
    echo [INFO] Or the scraping may not work properly
)

cd ..

echo.
echo [STEP 9] Installing TypeScript globally...
echo [INFO] Installing TypeScript for compilation...
node -e "require('child_process').exec('npm install -g typescript', (err,stdout,stderr) => { console.log(stdout); if(err) console.error('TypeScript install failed:', stderr); })"

echo.
echo [STEP 10] Testing compilation...
echo [INFO] Testing backend TypeScript...
cd backend
node -e "require('child_process').exec('npx tsc --noEmit', (err,stdout,stderr) => { if(err) console.log('TS issues:', stderr); else console.log('Backend TS: OK'); })"
cd ..

echo [INFO] Testing frontend TypeScript...
cd frontend  
node -e "require('child_process').exec('npx tsc --noEmit', (err,stdout,stderr) => { if(err) console.log('TS issues:', stderr); else console.log('Frontend TS: OK'); })"
cd ..

echo.
echo ===============================================================
echo [SUCCESS] Setup completed!
echo ===============================================================
echo.

:: Check what still needs manual installation
set "need_manual="
python --version >nul 2>&1 || py --version >nul 2>&1 || set "need_manual=!need_manual! Python"
git --version >nul 2>&1 || set "need_manual=!need_manual! Git"
if "!chrome_ok!"=="false" set "need_manual=!need_manual! Chrome"

if not "!need_manual!"=="" (
    echo [INFO] OPTIONAL - Install these for better experience:
    echo.
    if not "!need_manual:Python=!"=="!need_manual!" (
        echo       * Python: https://www.python.org/downloads/
        echo         ^> Check "Add Python to PATH" during install
    )
    if not "!need_manual:Git=!"=="!need_manual!" (
        echo       * Git: https://git-scm.com/download/win  
    )
    if not "!need_manual:Chrome=!"=="!need_manual!" (
        echo       * Google Chrome: https://www.google.com/chrome/
    )
    echo.
)

echo [NEXT STEPS] Ready to start:
echo       1. Edit data/proxy.txt - add your proxy servers
echo       2. Edit data/wallets.txt - add wallet addresses  
echo       3. Run the project:
echo          * Development: npm run dev
echo          * Production: start.bat
echo.
echo [LINKS] When running:
echo       * Frontend: http://localhost:5001
echo       * Backend API: http://localhost:5000/api/status
echo.
echo [POWERSHELL FIX] To fix npm in PowerShell (optional):
echo       Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
echo.

choice /c YN /m "Open config files for editing (Y/N)?" >nul 2>&1
if !errorlevel!==1 (
    if exist data\proxy.txt start notepad data\proxy.txt
    if exist data\wallets.txt start notepad data\wallets.txt
)

echo.
echo [SUCCESS] EVManager is ready to use!
pause