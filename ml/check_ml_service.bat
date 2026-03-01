@echo off
echo ========================================
echo ML Service Health Check
echo ========================================
echo.

echo Checking if ML service is running on port 5000...
netstat -ano | findstr :5000 > nul
if %errorlevel% equ 0 (
    echo [OK] Port 5000 is in use
    echo.
    echo Process details:
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000') do (
        tasklist /FI "PID eq %%a" | findstr python
    )
    echo.
    echo Testing ML service health endpoint...
    curl -s http://localhost:5000/health
    echo.
    echo.
    echo [SUCCESS] ML service is running and healthy!
) else (
    echo [ERROR] Port 5000 is not in use
    echo [ERROR] ML service is NOT running!
    echo.
    echo To start the ML service, run:
    echo   cd D:\cloud\ml
    echo   python -m uvicorn app:app --host 0.0.0.0 --port 5000
)

echo.
echo ========================================
pause
