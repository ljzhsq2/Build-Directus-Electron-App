@echo off
REM ===================================================================
REM Directus Desktop 11.5.1 - 启动脚本
REM ===================================================================

setlocal EnableDelayedExpansion

echo.
echo ================================================
echo   Directus Desktop 11.5.1
echo ================================================
echo.

REM 获取脚本所在目录
set "SCRIPT_DIR=%~dp0"
set "RUNTIME_DIR=%SCRIPT_DIR%runtime"
set "NODE_EXE=%RUNTIME_DIR%\node.exe"
set "DIRECTUS_DIR=%RUNTIME_DIR%\directus"
set "DIRECTUS_CLI=%DIRECTUS_DIR%\cli.js"

REM 数据目录（用户的 AppData\Roaming）
set "DATA_DIR=%APPDATA%\directus-desktop"
set "DB_DIR=%DATA_DIR%\database"
set "UPLOADS_DIR=%DATA_DIR%\uploads"
set "EXTENSIONS_DIR=%DATA_DIR%\extensions"
set "LOG_FILE=%DATA_DIR%\directus.log"

REM 检查 Node.js 是否存在
if not exist "%NODE_EXE%" (
    echo [ERROR] Node.js not found at: %NODE_EXE%
    echo Please reinstall Directus Desktop.
    pause
    exit /b 1
)

REM 检查 Directus CLI 是否存在
if not exist "%DIRECTUS_CLI%" (
    echo [ERROR] Directus CLI not found at: %DIRECTUS_CLI%
    echo Please reinstall Directus Desktop.
    pause
    exit /b 1
)

echo [INFO] Node.js found: %NODE_EXE%
echo [INFO] Directus CLI found: %DIRECTUS_CLI%
echo.

REM 创建数据目录（如果不存在）
if not exist "%DB_DIR%" (
    echo [INFO] Creating database directory...
    mkdir "%DB_DIR%"
)
if not exist "%UPLOADS_DIR%" (
    echo [INFO] Creating uploads directory...
    mkdir "%UPLOADS_DIR%"
)
if not exist "%EXTENSIONS_DIR%" (
    echo [INFO] Creating extensions directory...
    mkdir "%EXTENSIONS_DIR%"
)

echo [INFO] Data directory: %DATA_DIR%
echo   - Database: %DB_DIR%
echo   - Uploads: %UPLOADS_DIR%
echo   - Extensions: %EXTENSIONS_DIR%
echo.

REM 设置 Directus 环境变量
set "PORT=8055"
set "HOST=0.0.0.0"
set "PUBLIC_URL=http://localhost:8055"

REM 数据库配置
set "DB_CLIENT=sqlite3"
set "DB_FILENAME=%DB_DIR%\directus.db"
set "DB_SQLITE_USE_WAL=true"

REM 存储配置
set "STORAGE_LOCATIONS=local"
set "STORAGE_LOCAL_ROOT=%UPLOADS_DIR%"

REM 扩展配置
set "EXTENSIONS_PATH=%EXTENSIONS_DIR%"

REM 管理员配置（首次启动）
set "ADMIN_EMAIL=admin@example.com"
set "ADMIN_PASSWORD=admin"

REM 密钥（使用随机值）
set "KEY=directus-desktop-key-%RANDOM%%RANDOM%"
set "SECRET=directus-desktop-secret-%RANDOM%%RANDOM%"

REM 其他配置
set "TELEMETRY=false"
set "NODE_ENV=production"
set "LOG_LEVEL=info"
set "CACHE_ENABLED=true"
set "CACHE_STORE=memory"
set "CACHE_TTL=10m"

echo [INFO] Starting Directus server on port %PORT%...
echo [INFO] Log file: %LOG_FILE%
echo.
echo ================================================
echo   Directus is starting...
echo   Please wait for the browser to open
echo ================================================
echo.

REM 启动 Directus（输出到日志文件）
cd /d "%DIRECTUS_DIR%"
"%NODE_EXE%" "%DIRECTUS_CLI%" start >> "%LOG_FILE%" 2>&1 &

REM 等待几秒让服务器启动
timeout /t 5 /nobreak > nul

REM 打开浏览器
echo [INFO] Opening browser...
start http://localhost:%PORT%/admin

echo.
echo ================================================
echo   Directus is running!
echo   Access: http://localhost:%PORT%/admin
echo
echo   Default login:
echo     Email: admin@example.com
echo     Password: admin
echo
echo   Press Ctrl+C to stop the server
echo   Or close this window
echo ================================================
echo.

REM 保持窗口打开
pause
