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

let mainWindow;
let isSplashAnimationEnded;
let deeplinkingUrl;
let directusProcess = null;

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
        });

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
    console.log('Preparing Directus environment...');
    await prepareDirectus();

    console.log('Starting Directus server...');
    await startDirectusServer();

    console.log('Directus server started successfully on port 8055');
  } catch (error) {
    console.error('Failed to start Directus server:', error);
    dialog.showErrorBox('Directus Error', `Failed to start Directus server: ${error.message}`);
  }

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
  // Kill Directus process when app closes
  if (directusProcess) {
    console.log('Stopping Directus server...');
    directusProcess.kill();
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});
