@echo off
setlocal enabledelayedexpansion
title EVManager - Kill Ports

echo ===============================================================
echo               EVManager - Port Cleanup
echo ===============================================================
echo.
echo [INFO] Killing processes ONLY on ports 5000 and 5001...
echo.

set "found_processes=false"

REM Function to kill processes on specific port
echo [STEP 1] Checking port 5000...
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":5000.*LISTENING" 2^>nul') do (
    if not "%%p"=="0" if not "%%p"=="" (
        set "found_processes=true"
        echo [ACTION] Killing PID %%p on port 5000
        taskkill /F /PID %%p >nul 2>&1
        if !errorlevel! equ 0 (
            echo [OK] Successfully killed PID %%p
        ) else (
            echo [WARNING] Failed to kill PID %%p
        )
    )
)

echo [STEP 2] Checking port 5001...
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":5001.*LISTENING" 2^>nul') do (
    if not "%%p"=="0" if not "%%p"=="" (
        set "found_processes=true"
        echo [ACTION] Killing PID %%p on port 5001
        taskkill /F /PID %%p >nul 2>&1
        if !errorlevel! equ 0 (
            echo [OK] Successfully killed PID %%p
        ) else (
            echo [WARNING] Failed to kill PID %%p
        )
    )
)

if "!found_processes!"=="false" (
    echo [INFO] No processes found on ports 5000 or 5001
)

echo.
echo [STEP 3] Final verification...

set "ports_free=true"

for /f "tokens=*" %%a in ('netstat -aon ^| findstr ":5000.*LISTENING" 2^>nul') do (
    set "ports_free=false"
    echo [WARNING] Port 5000 still in use: %%a
)

for /f "tokens=*" %%a in ('netstat -aon ^| findstr ":5001.*LISTENING" 2^>nul') do (
    set "ports_free=false"
    echo [WARNING] Port 5001 still in use: %%a
)

echo.
echo ===============================================================
if "!ports_free!"=="true" (
    echo [SUCCESS] Ports 5000 and 5001 are now free!
    echo           Only targeted processes were killed
) else (
    echo [PARTIAL] Some processes may still be running on target ports
    echo           Try running as administrator if needed
)
echo ===============================================================
echo.
echo Press any key to exit...
pause >nul

exit /b 0