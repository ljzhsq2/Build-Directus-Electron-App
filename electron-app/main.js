const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let directusProcess;
const PORT = 8055;
let startupLogs = [];

// 配置自动更新
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on('update-available', (info) => {
  log(`发现新版本: ${info.version}`);
  if (mainWindow && !mainWindow.isDestroyed()) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '发现新版本',
      message: `发现新版本 ${info.version}，是否现在下载？`,
      buttons: ['下载', '稍后'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.downloadUpdate();
      }
    });
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  log(`下载进度: ${progressObj.percent.toFixed(1)}%`);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setProgressBar(progressObj.percent / 100);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  log(`更新已下载: ${info.version}`);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setProgressBar(-1);
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '更新已下载',
      message: `新版本 ${info.version} 已下载完成，重启应用后即可安装。`,
      buttons: ['立即重启', '稍后'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  }
});

autoUpdater.on('error', (err) => {
  log(`更新错误: ${err.message}`);
});

function log(msg) {
  const timestamp = new Date().toISOString();
  const logMsg = `[${timestamp}] ${msg}`;
  console.log(logMsg);
  startupLogs.push(logMsg);

  const logPath = path.join(app.getPath('userData'), 'directus.log');
  try {
    fs.appendFileSync(logPath, logMsg + '\n');
  } catch (e) {
    console.error('Failed to write log:', e);
  }
}

function getDirectusPath() {
  let directusPath;

  if (app.isPackaged) {
    directusPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'directus-app');
    log(`Packaged mode: ${directusPath}`);
  } else {
    directusPath = path.join(__dirname, '..', 'directus-app');
    log(`Development mode: ${directusPath}`);
  }

  if (!fs.existsSync(directusPath)) {
    log(`ERROR: Directus path does not exist: ${directusPath}`);
    return null;
  }

  log(`✓ Directus path found: ${directusPath}`);
  return directusPath;
}

function startDirectus() {
  const directusAppPath = getDirectusPath();

  if (!directusAppPath) {
    showErrorDialog(
      '找不到 Directus',
      `Directus 目录不存在。\n\n请查看日志：\n${path.join(app.getPath('userData'), 'directus.log')}`
    );
    return;
  }

  // 检查 server.js 是否存在
  const serverJs = path.join(directusAppPath, 'server.js');
  if (!fs.existsSync(serverJs)) {
    showErrorDialog(
      '找不到启动脚本',
      `server.js 不存在：\n${serverJs}\n\n请查看日志：\n${path.join(app.getPath('userData'), 'directus.log')}`
    );
    return;
  }

  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'database', 'directus.db');

  log('=== Directus 启动配置 ===');
  log(`App path: ${directusAppPath}`);
  log(`Server script: ${serverJs}`);
  log(`Database: ${dbPath}`);
  log(`User data: ${userDataPath}`);

  // 确保必要的目录存在
  const dbDir = path.dirname(dbPath);
  const uploadsDir = path.join(userDataPath, 'uploads');
  const extensionsDir = path.join(userDataPath, 'extensions');

  [dbDir, uploadsDir, extensionsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      log(`Created directory: ${dir}`);
    }
  });

  // 设置环境变量
  const env = {
    ...process.env,

    // 服务器配置
    PORT: PORT.toString(),
    HOST: '0.0.0.0',
    PUBLIC_URL: `http://localhost:${PORT}`,

    // 数据库配置
    DB_CLIENT: 'sqlite3',
    DB_FILENAME: dbPath,
    DB_SQLITE_USE_WAL: 'true',

    // 存储配置
    STORAGE_LOCATIONS: 'local',
    STORAGE_LOCAL_ROOT: uploadsDir,

    // 扩展配置
    EXTENSIONS_PATH: extensionsDir,

    // 管理员账号
    ADMIN_EMAIL: 'admin@example.com',
    ADMIN_PASSWORD: 'admin',

    // 密钥（每次启动随机生成）
    KEY: 'directus-desktop-key-' + Math.random().toString(36),
    SECRET: 'directus-desktop-secret-' + Math.random().toString(36),

    // 其他配置
    TELEMETRY: 'false',
    NODE_ENV: 'production',
    LOG_LEVEL: 'warn',
    CACHE_ENABLED: 'true',
    CACHE_STORE: 'memory',
    CACHE_TTL: '10m'
  };

  log(`Starting Directus: node "${serverJs}"`);
  log(`Working directory: ${directusAppPath}`);

  // 使用 Node.js 运行 server.js
  directusProcess = spawn(process.execPath, [serverJs], {
    env: env,
    cwd: directusAppPath,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });

  directusProcess.stdout.on('data', (data) => {
    const msg = data.toString().trim();
    log(`[STDOUT] ${msg}`);
  });

  directusProcess.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    // 过滤常见的无害警告
    if (!msg.includes('DeprecationWarning') &&
        !msg.includes('ExperimentalWarning') &&
        !msg.includes('punycode')) {
      log(`[STDERR] ${msg}`);
    }
  });

  directusProcess.on('error', (error) => {
    log(`ERROR: Failed to start process: ${error.message}`);
    showErrorDialog('启动失败', error.message);
  });

  directusProcess.on('close', (code) => {
    log(`Process exited with code ${code}`);
    if (code !== 0 && code !== null) {
      showErrorDialog('进程异常退出', `退出代码: ${code}`);
    }
  });

  log('✓ Process spawned successfully');
}

function showErrorDialog(title, message) {
  const logPath = path.join(app.getPath('userData'), 'directus.log');
  dialog.showErrorBox(
    title,
    message + '\n\n日志位置:\n' + logPath
  );
}

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    log('Window already exists');
    return;
  }

  const iconPath = path.join(__dirname, 'icon.ico');
  const windowOptions = {
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false
  };

  if (fs.existsSync(iconPath)) {
    windowOptions.icon = iconPath;
  }

  mainWindow = new BrowserWindow(windowOptions);
  log('Main window created');

  // 加载启动页面
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Directus 启动中</title>
      </head>
      <body style="margin:0;padding:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);">
        <div style="text-align:center;color:white;max-width:600px;padding:20px;">
          <div style="font-size:64px;margin-bottom:20px;">🚀</div>
          <h1 style="font-size:32px;font-weight:600;margin:0 0 10px 0;">Directus 11.5.1 启动中</h1>
          <p style="font-size:16px;opacity:0.9;margin:0 0 30px 0;">首次启动需要初始化数据库，请稍候...</p>
          <div style="width:300px;height:4px;background:rgba(255,255,255,0.3);border-radius:2px;overflow:hidden;margin:0 auto 20px auto;">
            <div style="width:100%;height:100%;background:white;animation:slide 1.5s ease-in-out infinite;"></div>
          </div>
          <div id="logs" style="margin-top:30px;padding:15px;background:rgba(0,0,0,0.3);border-radius:8px;max-height:300px;overflow-y:auto;text-align:left;font-size:11px;font-family:monospace;line-height:1.6;">
            <div>正在初始化...</div>
          </div>
          <style>
            @keyframes slide {
              0% { transform: translateX(-100%); }
              50% { transform: translateX(0); }
              100% { transform: translateX(100%); }
            }
          </style>
          <script>
            setInterval(async function() {
              if (window.electronAPI) {
                const logs = await window.electronAPI.getStartupLogs();
                const logsDiv = document.getElementById('logs');
                logsDiv.innerHTML = logs.slice(-20).map(l => '<div>' + l + '</div>').join('');
                logsDiv.scrollTop = logsDiv.scrollHeight;
              }
            }, 2000);
          </script>
        </div>
      </body>
    </html>
  `)}`)  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 5 秒后开始检查 Directus 是否就绪
  setTimeout(() => {
    checkDirectusReady();
  }, 5000);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 防止打开新窗口
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname !== 'localhost' && parsedUrl.hostname !== '127.0.0.1') {
      event.preventDefault();
      shell.openExternal(url);
      log(`Blocked navigation to: ${url}`);
    }
  });
}

function checkDirectusReady(attempts = 0) {
  if (attempts > 60) {
    log('ERROR: Directus 启动超时（60 次尝试）');
    const logPath = path.join(app.getPath('userData'), 'directus.log');
    showErrorDialog(
      'Directus 启动超时',
      `启动失败，请检查日志：\n${logPath}`
    );
    return;
  }

  const http = require('http');
  const options = {
    hostname: 'localhost',
    port: PORT,
    path: '/server/health',
    method: 'GET',
    timeout: 3000
  };

  const req = http.request(options, (res) => {
    if (res.statusCode === 200) {
      log(`✓ Directus is ready! (attempt ${attempts + 1})`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        setTimeout(() => {
          mainWindow.loadURL(`http://localhost:${PORT}/admin`);
        }, 2000);
      }
    } else {
      setTimeout(() => checkDirectusReady(attempts + 1), 2000);
    }
  });

  req.on('error', (err) => {
    if (attempts % 10 === 0) {
      log(`连接尝试 ${attempts + 1}/60: ${err.message}`);
    }
    setTimeout(() => checkDirectusReady(attempts + 1), 2000);
  });

  req.on('timeout', () => {
    req.destroy();
    setTimeout(() => checkDirectusReady(attempts + 1), 2000);
  });

  req.end();
}

// IPC handlers
ipcMain.handle('get-app-path', () => {
  return app.getPath('userData');
});

ipcMain.handle('open-external', (event, url) => {
  shell.openExternal(url);
});

ipcMain.handle('get-startup-logs', () => {
  return startupLogs;
});

// 单实例锁
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  log('Another instance is running, quitting...');
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.on('ready', () => {
    log('=== Application Starting ===');
    log(`App version: ${app.getVersion()}`);
    log(`Electron: ${process.versions.electron}`);
    log(`Node: ${process.versions.node}`);
    log(`Platform: ${process.platform}`);
    log(`Packaged: ${app.isPackaged}`);

    // 启动 Directus 和窗口
    startDirectus();
    createWindow();

    // 10 秒后检查更新
    setTimeout(() => {
      if (app.isPackaged) {
        log('Checking for updates...');
        autoUpdater.checkForUpdates().catch((err) => {
          log(`Update check failed: ${err.message}`);
        });
      }
    }, 10000);

    // F12 开发者工具
    const { globalShortcut } = require('electron');
    globalShortcut.register('F12', () => {
      if (mainWindow) {
        mainWindow.webContents.toggleDevTools();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (directusProcess) {
    directusProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  if (directusProcess) {
    directusProcess.kill('SIGTERM');
    setTimeout(() => {
      if (directusProcess && !directusProcess.killed) {
        directusProcess.kill('SIGKILL');
      }
    }, 1000);
  }
});
