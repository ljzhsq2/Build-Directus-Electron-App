const {
  app, BrowserWindow, ipcMain, dialog,
} = require('electron');
const path = require('path');
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

let mainWindow;
let isSplashAnimationEnded;
let deeplinkingUrl;

const prepareDirectus = async () => {
  const config = require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
  if (config.parsed.DB_FILENAME) process.env.DB_FILENAME = path.resolve(__dirname, '../', config.parsed.DB_FILENAME);
  if (config.parsed.EXTENSIONS_PATH) process.env.EXTENSIONS_PATH = path.resolve(__dirname, '../', config.parsed.EXTENSIONS_PATH);
  if (config.parsed.STORAGE_LOCAL_ROOT) process.env.STORAGE_LOCAL_ROOT = path.resolve(__dirname, '../', config.parsed.STORAGE_LOCAL_ROOT);
  if (config.parsed.PACKAGE_FILE_LOCATION) process.env.PACKAGE_FILE_LOCATION = path.resolve(__dirname, '../', config.parsed.PACKAGE_FILE_LOCATION);
  if (app.isPackaged) process.env.LOG_LEVEL = 'silent';

  // For Directus 11.x, we need to import the server differently
  return await import('directus');
};

const createWindow = async () => {
  const handleHideSplashScreen = (splashScreen, window) => {
    if (!isSplashAnimationEnded) {
      isSplashAnimationEnded = true;
      return;
    }
    splashScreen.close();
    window.show();
    window.focus();
  };

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const splashScreen = new BrowserWindow({
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

  ipcMain.handle('onSplashEnded', () => {
    handleHideSplashScreen(splashScreen, mainWindow);
  });

  mainWindow.once('ready-to-show', () => {
    handleHideSplashScreen(splashScreen, mainWindow);
  });

  splashScreen.loadFile(path.join(__dirname, 'splash.html'));

  // Start Directus server
  try {
    const directusModule = await prepareDirectus();

    // For Directus 11.x, we need to use the createDirectus API
    // This is a simplified version - you may need to adjust based on Directus 11.x API
    if (directusModule.startServer) {
      await directusModule.startServer();
    }
  } catch (error) {
    console.error('Failed to start Directus server:', error);
  }

  // Wait for Directus to be ready
  await new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, 10000);
  });

  mainWindow.loadURL('http://localhost:8055');

  if (!app.isPackaged) mainWindow.webContents.openDevTools();
};

app.on('second-instance', (_, commandLine) => {
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
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('open-url', (_, url) => {
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
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
