@echo off
title EVManager - Clear Database
echo ===============================================================
echo       EVManager - Database Cleanup
echo ===============================================================
echo.

echo [WARNING] This will delete ALL database data!
echo.
echo This operation will remove:
echo   • All wallet data
echo   • All token information
echo   • All protocol data
echo   • All cached results
echo   • All transaction history
echo.

choice /c YN /m "Are you sure you want to continue (Y/N)?"
if %errorlevel% neq 1 (
    echo [CANCELLED] Database cleanup cancelled
    echo.
    pause
    exit /b 0
)

echo.
echo [INFO] Starting database cleanup...

:: Check if backend is running
echo [CHECK] Checking if backend is running...
netstat -an | find ":5000 " >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Backend is running, using API to clear data
    echo.
    
    echo [INFO] Backend is running - stopping it gracefully...
    
    echo [ACTION] Attempting graceful shutdown via API...
    curl -X POST http://localhost:5000/api/system/shutdown 2>nul
    
    echo [INFO] Waiting for backend to stop...
    timeout /t 3 >nul
    
    echo [INFO] API cleanup completed, proceeding with file cleanup for safety...
    goto :file_cleanup
) else (
    echo [INFO] Backend not running, using file deletion
    goto :file_cleanup
)

:file_cleanup
echo.
echo [ACTION] Deleting database files...

:: Remove SQLite database files
if exist "backend\data\*.db" (
    del /q "backend\data\*.db" 2>nul
    echo [OK] Deleted SQLite database files
) else (
    echo [INFO] No SQLite database files found
)

if exist "backend\data\*.sqlite" (
    del /q "backend\data\*.sqlite" 2>nul
    echo [OK] Deleted SQLite files
)

:: Remove JSON data files (specific files)
if exist "backend\data\wallet_database.json" (
    del /q "backend\data\wallet_database.json" 2>nul
    echo [OK] Deleted wallet database file
)

if exist "backend\data\wallet_cache.json" (
    del /q "backend\data\wallet_cache.json" 2>nul
    echo [OK] Deleted wallet cache file
)

if exist "backend\data\wallets_data.json" (
    del /q "backend\data\wallets_data.json" 2>nul
    echo [OK] Deleted processed wallets data file
)

if exist "backend\data\processing_state.json" (
    del /q "backend\data\processing_state.json" 2>nul
    echo [OK] Deleted processing state file
)

:: Remove any other JSON files in data directory
if exist "backend\data\*.json" (
    del /q "backend\data\*.json" 2>nul
    echo [OK] Deleted remaining JSON data files
)

:: Remove cache directories
if exist "backend\cache" (
    rmdir /s /q "backend\cache" 2>nul
    echo [OK] Deleted cache directory
)

:: Don't delete Puppeteer Chrome cache as it's expensive to re-download
if exist "backend\.cache" (
    echo [INFO] Skipping .cache directory (contains Puppeteer Chrome)
    echo [INFO] To remove Chrome cache manually: rmdir /s backend\.cache
)

:: Remove log files
if exist "backend\logs" (
    if exist "backend\logs\*.log" (
        del /q "backend\logs\*.log" 2>nul
        echo [OK] Deleted log files
    )
)

if exist "backend\*.log" (
    del /q "backend\*.log" 2>nul
    echo [OK] Deleted root log files
)

:: Remove temp files
if exist "backend\temp" (
    rmdir /s /q "backend\temp" 2>nul
    echo [OK] Deleted temp directory
)

:: Remove node.js temporary files
if exist "backend\data\*.tmp" (
    del /q "backend\data\*.tmp" 2>nul
    echo [OK] Deleted temporary files
)

:success
echo.
echo ===============================================================
echo [SUCCESS] Database cleanup completed!
echo ===============================================================
echo.
echo [INFO] What was cleaned:
echo   [OK] All wallet data removed
echo   [OK] Token and protocol data cleared
echo   [OK] Cache and temporary files deleted
echo   [OK] Log files cleaned
echo.
echo [NEXT STEPS]:
echo   1. Restart the application: start.bat
echo   2. Add wallet addresses to data/wallets.txt
echo   3. Configure proxies in data/proxy.txt
echo   4. Run wallet processing to collect fresh data
echo.
echo Press any key to exit...
pause >nul