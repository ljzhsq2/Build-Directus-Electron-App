const {
  app, BrowserWindow, ipcMain, dialog,
} = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const electronSquirrelStartup = require('electron-squirrel-startup');

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('directus', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('directus');
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (electronSquirrelStartup) {
  app.quit();
}

let mainWindow = null;
let splashScreen = null;
let isSplashAnimationEnded = false;
let deeplinkingUrl;
let directusProcess = null;
let isDirectusStarted = false;
let ipcHandlersRegistered = false;
let isCreatingWindow = false; // 添加创建窗口的锁

const prepareDirectus = async () => {
  const config = require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

  // Set up environment variables with absolute paths
  if (config.parsed) {
    if (config.parsed.DB_FILENAME) {
      process.env.DB_FILENAME = path.resolve(__dirname, '../', config.parsed.DB_FILENAME);
    }
    if (config.parsed.EXTENSIONS_PATH) {
      process.env.EXTENSIONS_PATH = path.resolve(__dirname, '../', config.parsed.EXTENSIONS_PATH);
    }
    if (config.parsed.STORAGE_LOCAL_ROOT) {
      process.env.STORAGE_LOCAL_ROOT = path.resolve(__dirname, '../', config.parsed.STORAGE_LOCAL_ROOT);
    }

    // Copy all other env vars
    Object.keys(config.parsed).forEach(key => {
      if (!process.env[key]) {
        process.env[key] = config.parsed[key];
      }
    });
  }

  if (app.isPackaged) {
    process.env.LOG_LEVEL = 'silent';
  }
};

const startDirectusServer = async () => {
  // Prevent starting Directus multiple times
  if (isDirectusStarted) {
    console.log('Directus server already started, skipping...');
    return;
  }

  return new Promise((resolve, reject) => {
    try {
      // Get the path to directus CLI
      const directusCliPath = path.join(__dirname, '../node_modules/directus/cli.js');
      const nodeExecutable = process.execPath;

      console.log('Node executable:', nodeExecutable);
      console.log('Directus CLI path:', directusCliPath);

      // First, run bootstrap to initialize database
      console.log('Running Directus bootstrap...');
      const bootstrap = spawn(nodeExecutable, [directusCliPath, 'bootstrap'], {
        env: process.env,
        stdio: 'inherit',
      });

      bootstrap.on('close', (code) => {
        if (code !== 0) {
          console.error(`Bootstrap process exited with code ${code}`);
        }

        // After bootstrap, start the server
        console.log('Starting Directus server...');
        directusProcess = spawn(nodeExecutable, [directusCliPath, 'start'], {
          env: process.env,
          stdio: 'pipe',
        });

        directusProcess.stdout.on('data', (data) => {
          console.log(`Directus: ${data}`);
        });

        directusProcess.stderr.on('data', (data) => {
          console.error(`Directus Error: ${data}`);
        });

        directusProcess.on('close', (code) => {
          console.log(`Directus process exited with code ${code}`);
          isDirectusStarted = false;
        });

        // Mark as started
        isDirectusStarted = true;

        // Wait a bit for server to start
        setTimeout(() => {
          resolve();
        }, 5000);
      });

      bootstrap.on('error', (error) => {
        console.error('Failed to start bootstrap:', error);
        reject(error);
      });
    } catch (error) {
      console.error('Error starting Directus:', error);
      reject(error);
    }
  });
};

const createWindow = async () => {
  console.log('[DEBUG] createWindow called');
  console.log('[DEBUG] isCreatingWindow:', isCreatingWindow);
  console.log('[DEBUG] mainWindow exists:', mainWindow !== null);
  console.log('[DEBUG] mainWindow destroyed:', mainWindow ? mainWindow.isDestroyed() : 'N/A');

  // Prevent concurrent window creation
  if (isCreatingWindow) {
    console.log('[DEBUG] Already creating window, aborting...');
    return;
  }

  // Prevent creating multiple windows
  if (mainWindow && !mainWindow.isDestroyed()) {
    console.log('[DEBUG] Main window already exists, focusing...');
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    return;
  }

  isCreatingWindow = true;
  console.log('[DEBUG] Starting window creation...');

  try {
    const handleHideSplashScreen = (splash, window) => {
      console.log('[DEBUG] handleHideSplashScreen called, isSplashAnimationEnded:', isSplashAnimationEnded);
      if (!isSplashAnimationEnded) {
        isSplashAnimationEnded = true;
        return;
      }
      if (splash && !splash.isDestroyed()) {
        console.log('[DEBUG] Closing splash screen');
        splash.close();
      }
      if (window && !window.isDestroyed()) {
        console.log('[DEBUG] Showing main window');
        window.show();
        window.focus();
      }
    };

    console.log('[DEBUG] Creating main window...');
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    console.log('[DEBUG] Creating splash screen...');
    splashScreen = new BrowserWindow({
      width: 480,
      height: 270,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    // Register IPC handlers only once
    if (!ipcHandlersRegistered) {
      console.log('[DEBUG] Registering IPC handlers...');
      ipcMain.handle('onSplashEnded', () => {
        handleHideSplashScreen(splashScreen, mainWindow);
      });
      ipcHandlersRegistered = true;
    }

    mainWindow.once('ready-to-show', () => {
      console.log('[DEBUG] Main window ready-to-show event');
      handleHideSplashScreen(splashScreen, mainWindow);
    });

    // Clean up when window is closed
    mainWindow.on('closed', () => {
      console.log('[DEBUG] Main window closed');
      mainWindow = null;
      isCreatingWindow = false;
    });

    if (splashScreen) {
      splashScreen.on('closed', () => {
        console.log('[DEBUG] Splash screen closed');
        splashScreen = null;
      });
    }

    console.log('[DEBUG] Loading splash screen HTML...');
    splashScreen.loadFile(path.join(__dirname, 'splash.html'));

    // Start Directus server only once
    try {
      console.log('[DEBUG] Preparing Directus environment...');
      await prepareDirectus();

      console.log('[DEBUG] Starting Directus server...');
      await startDirectusServer();

      console.log('[DEBUG] Directus server started successfully on port 8055');
    } catch (error) {
      console.error('[DEBUG] Failed to start Directus server:', error);
      dialog.showErrorBox('Directus Error', `Failed to start Directus server: ${error.message}`);
    }

    console.log('[DEBUG] Loading main window URL...');
    mainWindow.loadURL('http://localhost:8055');

    if (!app.isPackaged) {
      console.log('[DEBUG] Opening DevTools...');
      mainWindow.webContents.openDevTools();
    }

    console.log('[DEBUG] Window creation completed');
    isCreatingWindow = false;
  } catch (error) {
    console.error('[DEBUG] Error in createWindow:', error);
    isCreatingWindow = false;
    throw error;
  }
};

app.on('second-instance', (_, commandLine) => {
  console.log('[DEBUG] second-instance event fired');
  if (process.platform !== 'darwin') {
    deeplinkingUrl = commandLine.find((arg) => arg.startsWith('directus://'));
  }
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }

  if (deeplinkingUrl) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Welcome Back',
      message: `You arrived from: ${deeplinkingUrl}`,
    });
  }
});

app.whenReady().then(async () => {
  console.log('[DEBUG] app.whenReady fired');
  createWindow();
});

// Register activate event handler only once, OUTSIDE of whenReady
app.on('activate', () => {
  console.log('[DEBUG] activate event fired');
  console.log('[DEBUG] Window count:', BrowserWindow.getAllWindows().length);
  // On macOS it's common to re-create a window when the dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('open-url', (_, url) => {
  console.log('[DEBUG] open-url event fired:', url);
  deeplinkingUrl = url;
  if (mainWindow) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Welcome Back',
      message: `You arrived from: ${deeplinkingUrl}`,
    });
  }
});

app.on('window-all-closed', () => {
  console.log('[DEBUG] window-all-closed event fired');
  // Kill Directus process when app closes
  if (directusProcess) {
    console.log('Stopping Directus server...');
    directusProcess.kill();
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});
