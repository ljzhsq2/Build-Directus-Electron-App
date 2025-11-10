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
autoUpdater.autoDownload = false;  // 手动控制下载
autoUpdater.autoInstallOnAppQuit = true;  // 退出时自动安装

autoUpdater.on('update-available', (info) => {
  log(`New version available: ${info.version}`);
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
        log('User chose to download update');
      }
    });
  }
});

autoUpdater.on('update-not-available', () => {
  log('No updates available');
});

autoUpdater.on('download-progress', (progressObj) => {
  const msg = `下载进度: ${progressObj.percent.toFixed(1)}%`;
  log(msg);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setProgressBar(progressObj.percent / 100);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  log(`Update downloaded: ${info.version}`);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setProgressBar(-1);  // 清除进度条
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
  log(`Update error: ${err.message}`);
});

function log(msg) {
  const timestamp = new Date().toISOString();
  const logMsg = `[${timestamp}] ${msg}`;
  console.log(logMsg);
  startupLogs.push(logMsg);

  // 写入日志文件
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
    // 打包后的路径 - 在 app.asar.unpacked 中
    directusPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'directus-app');
    log(`Packaged mode: checking ${directusPath}`);
  } else {
    // 开发模式
    directusPath = path.join(__dirname, 'directus-app');
    log(`Development mode: checking ${directusPath}`);
  }

  // 验证路径是否存在
  if (!fs.existsSync(directusPath)) {
    log(`ERROR: Directus path does not exist: ${directusPath}`);

    // 尝试备用路径
    const alternativePaths = [
      path.join(process.resourcesPath, 'directus-app'),
      path.join(app.getAppPath(), 'directus-app'),
      path.join(__dirname, 'directus-app')
    ];

    for (const altPath of alternativePaths) {
      log(`Trying alternative path: ${altPath}`);
      if (fs.existsSync(altPath)) {
        log(`✓ Found Directus at: ${altPath}`);
        directusPath = altPath;
        break;
      }
    }

    // 如果所有路径都不存在，列出 resources 目录内容
    if (!fs.existsSync(directusPath)) {
      log('Listing process.resourcesPath contents:');
      try {
        const items = fs.readdirSync(process.resourcesPath);
        items.forEach(item => log(`  - ${item}`));

        if (fs.existsSync(path.join(process.resourcesPath, 'app.asar.unpacked'))) {
          log('Listing app.asar.unpacked contents:');
          const unpackedItems = fs.readdirSync(path.join(process.resourcesPath, 'app.asar.unpacked'));
          unpackedItems.forEach(item => log(`  - ${item}`));
        }
      } catch (e) {
        log(`Error listing directories: ${e.message}`);
      }
    }
  } else {
    log(`✓ Directus path exists: ${directusPath}`);
  }

  return directusPath;
}

function findDirectusCLI(directusAppPath) {
  // 使用我们的包装器，它可以正确加载 ES Module
  const wrapperPath = path.join(directusAppPath, 'directus-wrapper.mjs');

  log('Searching for Directus CLI...');
  log(`  Checking wrapper: ${wrapperPath}`);

  if (fs.existsSync(wrapperPath)) {
    log(`  ✓ Found wrapper at: ${wrapperPath}`);
    return wrapperPath;
  }

  // 备用方案：可能的 CLI 路径
  const possiblePaths = [
    path.join(directusAppPath, 'dist', 'start.js'),
    path.join(directusAppPath, 'dist', 'index.js'),
    path.join(directusAppPath, 'dist', 'cli', 'index.js'),
    path.join(directusAppPath, 'dist', 'cli.js'),
    path.join(directusAppPath, 'node_modules', '.bin', 'directus'),
    path.join(directusAppPath, 'node_modules', 'directus', 'dist', 'cli', 'index.js'),
    path.join(directusAppPath, 'node_modules', 'directus', 'dist', 'start.js'),
    path.join(directusAppPath, 'cli.js')
  ];

  for (const cliPath of possiblePaths) {
    log(`  Checking: ${cliPath}`);
    if (fs.existsSync(cliPath)) {
      log(`  ✓ Found CLI at: ${cliPath}`);
      return cliPath;
    }
  }

  // 没找到，列出目录结构帮助诊断
  log('ERROR: Could not find Directus CLI in any expected location');
  log('Directory contents:');
  try {
    const items = fs.readdirSync(directusAppPath);
    items.slice(0, 30).forEach(item => {
      const fullPath = path.join(directusAppPath, item);
      const stats = fs.statSync(fullPath);
      const type = stats.isDirectory() ? 'DIR' : 'FILE';
      log(`  [${type}] ${item}`);
    });

    const distPath = path.join(directusAppPath, 'dist');
    if (fs.existsSync(distPath)) {
      log('Contents of dist/ directory:');
      const distItems = fs.readdirSync(distPath);
      distItems.slice(0, 20).forEach(item => {
        log(`  - ${item}`);
      });
    }
  } catch (e) {
    log(`Error reading directory: ${e.message}`);
  }

  return null;
}

function startDirectus() {
  const directusAppPath = getDirectusPath();

  if (!fs.existsSync(directusAppPath)) {
    showErrorDialog(
      '找不到 Directus 文件',
      `Directus 应用目录不存在：\n${directusAppPath}\n\n这可能是打包配置问题。\n\n请查看日志：\n${path.join(app.getPath('userData'), 'directus.log')}`
    );
    return;
  }

  const directusCliPath = findDirectusCLI(directusAppPath);

  if (!directusCliPath) {
    showErrorDialog(
      '找不到 Directus CLI',
      `无法在以下目录中找到 Directus CLI：\n${directusAppPath}\n\n请查看日志：\n${path.join(app.getPath('userData'), 'directus.log')}`
    );
    return;
  }

  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'database', 'directus.db');
  const logPath = path.join(userDataPath, 'directus.log');

  log('=== Directus 启动配置 ===');
  log(`App path: ${directusAppPath}`);
  log(`CLI path: ${directusCliPath}`);
  log(`Database path: ${dbPath}`);
  log(`Log path: ${logPath}`);

  // 确保数据库目录存在
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    log(`Created database directory: ${dbDir}`);
  }

  // 设置环境变量
  const env = {
    ...process.env,
    PORT: PORT.toString(),
    HOST: '0.0.0.0',
    PUBLIC_URL: `http://localhost:${PORT}`,

    // 数据库配置
    DB_CLIENT: 'sqlite3',
    DB_FILENAME: dbPath,

    // 性能优化：使用 WAL 模式
    DB_SQLITE_USE_WAL: 'true',

    // 存储配置
    STORAGE_LOCATIONS: 'local',
    STORAGE_LOCAL_ROOT: path.join(userDataPath, 'uploads'),

    // 扩展配置
    EXTENSIONS_PATH: path.join(userDataPath, 'extensions'),

    // 管理员配置
    ADMIN_EMAIL: 'admin@example.com',
    ADMIN_PASSWORD: 'admin',

    // 密钥
    KEY: 'directus-desktop-key-' + Math.random().toString(36),
    SECRET: 'directus-desktop-secret-' + Math.random().toString(36),

    // 禁用遥测
    TELEMETRY: 'false',

    // 性能优化
    NODE_ENV: 'production',
    LOG_LEVEL: 'warn',  // 减少日志输出，提升性能

    // 缓存配置
    CACHE_ENABLED: 'true',
    CACHE_STORE: 'memory',
    CACHE_TTL: '10m'
  };

  log(`Starting Directus via wrapper: "${directusCliPath}"`);
  log(`Working directory: ${directusAppPath}`);

  // 使用 wrapper 来启动 Directus
  // wrapper 是一个 .mjs 文件，需要 ELECTRON_RUN_AS_NODE=1 才能作为 ES Module 加载
  const args = [directusCliPath];

  log('Environment configuration:');
  log(`  ELECTRON_RUN_AS_NODE: 1 (enables ES Module support)`);
  log(`  PORT: ${env.PORT}`);
  log(`  DB_CLIENT: ${env.DB_CLIENT}`);
  log(`  DB_FILENAME: ${env.DB_FILENAME}`);

  directusProcess = spawn(process.execPath, args, {
    env: {
      ...env,
      ELECTRON_RUN_AS_NODE: '1'  // 让 Electron 以 Node.js 模式运行 wrapper
    },
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
  // 如果窗口已存在，不重复创建
  if (mainWindow && !mainWindow.isDestroyed()) {
    log('Window already exists, skipping creation');
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

  // 只有在图标文件存在时才设置
  if (fs.existsSync(iconPath)) {
    windowOptions.icon = iconPath;
  }

  mainWindow = new BrowserWindow(windowOptions);
  log('Main window created');

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
          <h1 style="font-size:32px;font-weight:600;margin:0 0 10px 0;">Directus 启动中</h1>
          <p style="font-size:16px;opacity:0.9;margin:0 0 30px 0;">首次启动需要初始化数据库，请稍候...</p>
          <div style="width:300px;height:4px;background:rgba(255,255,255,0.3);border-radius:2px;overflow:hidden;margin:0 auto 20px auto;">
            <div style="width:100%;height:100%;background:white;animation:slide 1.5s ease-in-out infinite;"></div>
          </div>
          <div id="logs" style="margin-top:30px;padding:15px;background:rgba(0,0,0,0.3);border-radius:8px;max-height:300px;overflow-y:auto;text-align:left;font-size:11px;font-family:monospace;line-height:1.6;">
            <div>正在初始化...</div>
          </div>
          <button onclick="showLogs()" style="margin-top:20px;padding:10px 20px;background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.3);color:white;border-radius:5px;cursor:pointer;font-size:14px;">
            查看详细日志
          </button>
          <style>
            @keyframes slide {
              0% { transform: translateX(-100%); }
              50% { transform: translateX(0); }
              100% { transform: translateX(100%); }
            }
            button:hover {
              background:rgba(255,255,255,0.3);
            }
          </style>
          <script>
            let updateInterval;
            window.addEventListener('load', function() {
              updateLogs();
              updateInterval = setInterval(updateLogs, 2000);
            });

            async function updateLogs() {
              if (window.electronAPI) {
                const logs = await window.electronAPI.getStartupLogs();
                const logsDiv = document.getElementById('logs');
                logsDiv.innerHTML = logs.slice(-20).map(l => '<div>' + l + '</div>').join('');
                logsDiv.scrollTop = logsDiv.scrollHeight;
              }
            }

            function showLogs() {
              if (window.electronAPI) {
                const userDataPath = window.electronAPI.getAppPath();
                alert('日志文件位置: ' + userDataPath + '/directus.log');
              }
            }
          </script>
        </div>
      </body>
    </html>
  `)}`);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  setTimeout(() => {
    checkDirectusReady();
  }, 5000);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 阻止所有新窗口打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // 所有外部链接都在系统浏览器中打开
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 阻止导航到外部链接
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url);
    const currentUrl = mainWindow.webContents.getURL();

    // 如果不是 localhost，阻止导航并在外部浏览器打开
    if (parsedUrl.hostname !== 'localhost' && parsedUrl.hostname !== '127.0.0.1') {
      event.preventDefault();
      shell.openExternal(url);
      log(`Blocked navigation to external URL: ${url}`);
    }
  });

  // 防止意外的新窗口
  mainWindow.webContents.on('new-window', (event, url) => {
    event.preventDefault();
    shell.openExternal(url);
    log(`Blocked new window: ${url}`);
  });
}

function checkDirectusReady(attempts = 0) {
  if (attempts > 60) {
    log('ERROR: Directus failed to start after 60 attempts (2 minutes)');
    const logPath = path.join(app.getPath('userData'), 'directus.log');
    showErrorDialog(
      'Directus 启动超时',
      `启动失败，请检查日志文件：\n${logPath}`
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
      log(`Connection attempt ${attempts + 1}/60: ${err.message}`);
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

// 防止多个实例同时运行
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  log('Another instance is already running, quitting...');
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // 当运行第二个实例时，聚焦到已有的窗口
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.on('ready', () => {
    log('=== Application Starting ===');
    log(`App version: ${app.getVersion()}`);
    log(`Electron version: ${process.versions.electron}`);
    log(`Node version: ${process.versions.node}`);
    log(`Platform: ${process.platform}`);
    log(`Is packaged: ${app.isPackaged}`);
    log(`App path: ${app.getAppPath()}`);
    log(`Resources path: ${process.resourcesPath}`);
    log(`User data: ${app.getPath('userData')}`);

    // 并行启动：Directus 和窗口同时创建
    startDirectus();
    createWindow();  // 不等待 2 秒，直接创建窗口

    // 5 秒后开始健康检查（减少等待时间）
    setTimeout(() => {
      checkDirectusReady();
    }, 5000);

    // 10 秒后检查更新（不阻塞启动）
    setTimeout(() => {
      if (app.isPackaged) {  // 只在打包后的应用中检查更新
        log('Checking for updates...');
        autoUpdater.checkForUpdates().catch((err) => {
          log(`Check for updates error: ${err.message}`);
        });
      }
    }, 10000);

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
