@echo off
REM ===================================================================
REM Directus Desktop 11.5.1 - 停止脚本
REM ===================================================================

echo.
echo ================================================
echo   Stopping Directus Desktop...
echo ================================================
echo.

REM 查找并结束 node.exe 进程（运行 Directus 的）
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq node.exe" /FO LIST ^| find "PID:"') do (
    set "PID=%%a"
    echo Found Node.js process: PID !PID!
    taskkill /PID !PID! /F
)

echo.
echo Directus stopped.
echo.

pause
