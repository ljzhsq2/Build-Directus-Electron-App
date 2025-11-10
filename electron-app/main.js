const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let directusProcess;
const PORT = 8055;
let startupLogs = [];

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
  // 可能的 CLI 路径（按优先级排序）
  const possiblePaths = [
    path.join(directusAppPath, 'cli.js'),
    path.join(directusAppPath, 'dist', 'cli.js'),
    path.join(directusAppPath, 'dist', 'cli', 'index.js'),
    path.join(directusAppPath, 'dist', 'index.js'),
    path.join(directusAppPath, 'node_modules', 'directus', 'dist', 'cli', 'index.js'),
    path.join(directusAppPath, 'node_modules', '.bin', 'directus'),
  ];

  log('Searching for Directus CLI...');
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

    // 如果有 dist 目录，也列出其内容
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

    NODE_ENV: 'production',
    LOG_LEVEL: 'info'
  };

  log(`Starting Directus: node "${directusCliPath}" start`);
  log(`Working directory: ${directusAppPath}`);

  directusProcess = spawn(process.execPath, [directusCliPath, 'start'], {
    env: env,
    cwd: directusAppPath,
    stdio: ['ignore', 'pipe', 'pipe']
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
  }, 15000);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
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

  startDirectus();
  setTimeout(createWindow, 2000);

  const { globalShortcut } = require('electron');
  globalShortcut.register('F12', () => {
    if (mainWindow) {
      mainWindow.webContents.toggleDevTools();
    }
  });
});

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
