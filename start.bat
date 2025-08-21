@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ===============================================================
echo               EVManager - Production Mode
echo ===============================================================
echo.

echo [DEBUG] Current directory: %CD%
echo [DEBUG] Command line: %CMDCMDLINE%
echo.

:: Detailed project structure check
echo [CHECK] Checking project structure...
if not exist "backend" (
    echo [ERROR] Backend folder not found!
    dir /b
    pause
    exit /b 1
)
if not exist "frontend" (
    echo [ERROR] Frontend folder not found!
    dir /b  
    pause
    exit /b 1
)
echo [OK] Project structure is correct

:: Check Node.js
echo.
echo [CHECK] Checking Node.js...
node --version
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found!
    pause
    exit /b 1
)
echo [OK] Node.js found

:: Check npm
echo.
echo [CHECK] Checking npm...
call npm --version
if %errorlevel% neq 0 (
    echo [ERROR] npm not found!
    pause
    exit /b 1
)
echo [OK] npm found

:: Check backend dependencies
echo.
echo [CHECK] Checking backend dependencies...
if not exist "backend\node_modules" (
    echo [WARNING] Backend dependencies not installed
    echo [ACTION] Installing backend dependencies...
    cd backend
    call npm install
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to install backend dependencies
        pause
        exit /b 1
    )
    cd ..
    echo [OK] Backend dependencies installed
) else (
    echo [OK] Backend dependencies found
)

:: Check frontend dependencies
echo.
echo [CHECK] Checking frontend dependencies...
if not exist "frontend\node_modules" (
    echo [WARNING] Frontend dependencies not installed
    echo [ACTION] Installing frontend dependencies...
    cd frontend
    call npm install
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to install frontend dependencies
        pause
        exit /b 1
    )
    cd ..
    echo [OK] Frontend dependencies installed
) else (
    echo [OK] Frontend dependencies found
)

:: Create data directory
echo.
echo [SETUP] Creating data directory...
if not exist "data" (
    mkdir data
    echo [OK] Data directory created
) else (
    echo [OK] Data directory already exists
)

:: Create configuration files
if not exist "data\proxy.txt" (
    echo # Add your proxies here > data\proxy.txt
    echo [INFO] Created data\proxy.txt file
)
if not exist "data\wallets.txt" (
    echo # Add wallet addresses here > data\wallets.txt  
    echo [INFO] Created data\wallets.txt file
)

:: Build backend
echo.
echo [BUILD] Building backend...
cd backend
echo [DEBUG] Current directory: %CD%

call npm run build
if !errorlevel! neq 0 (
    echo [ERROR] Backend build failed
    echo [DEBUG] Checking if TypeScript is available...
    call npx tsc --version
    pause
    exit /b 1
)
echo [OK] Backend built successfully

:: Check if files are compiled
if exist "dist\server.js" (
    echo [OK] File dist\server.js created
) else (
    echo [ERROR] File dist\server.js not found after build!
    dir dist /b
    pause
    exit /b 1
)
cd ..

:: Build frontend
echo.
echo [BUILD] Building frontend...
cd frontend
echo [DEBUG] Current directory: %CD%

call npm run build
if !errorlevel! neq 0 (
    echo [ERROR] Frontend build failed
    echo [DEBUG] Checking vite...
    call npx vite --version
    pause
    exit /b 1
)
echo [OK] Frontend built successfully

:: Check if build folder is created
if exist "dist" (
    echo [OK] Dist folder created
    dir dist /b
) else (
    echo [ERROR] Dist folder not found after build!
    dir /b
    pause
    exit /b 1
)
cd ..

:: Start backend
echo.
echo [START] Starting backend...
echo [DEBUG] Command: start "EVManager Backend" cmd /k "cd /d %~dp0backend && npm start"
start "EVManager Backend" cmd /k "cd /d %~dp0backend && npm start"

:: Wait for backend
echo [WAIT] Waiting for backend startup (5 seconds)...
timeout /t 5 /nobreak >nul

:: Check backend availability
echo [TEST] Checking backend API...
curl -s http://localhost:5000/api/status >nul 2>&1
if !errorlevel! equ 0 (
    echo [OK] Backend API responding
) else (
    echo [WARNING] Backend API not responding (may still be starting)
)

:: Start frontend
echo.
echo [START] Starting frontend...
echo [DEBUG] Command: start "EVManager Frontend" cmd /k "cd /d %~dp0frontend && npm run preview"
start "EVManager Frontend" cmd /k "cd /d %~dp0frontend && npm run preview"

:: Wait for frontend
echo [WAIT] Waiting for frontend startup (3 seconds)...
timeout /t 3 /nobreak >nul

:: Open browser
echo [BROWSER] Opening browser...
start http://localhost:5001

echo.
echo ===============================================================
echo [SUCCESS] EVManager started in production mode!
echo ===============================================================
echo.
echo [LINKS]
echo    • Frontend: http://localhost:5001
echo    • Backend API: http://localhost:5000/api/status
echo.
echo [INFO] Applications started in separate windows
echo [INFO] To stop, close those windows
echo.
echo [DEBUG] If there are problems:
echo    1. Check backend and frontend windows for errors
echo    2. Make sure ports 5000 and 5001 are free
echo    3. Run setup.bat for complete reinstallation
echo.
echo Press any key to exit...
pause >nul