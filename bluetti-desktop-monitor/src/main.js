const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const BluetoothManager = require('./bluetooth/manager');
const Logger = require('./utils/logger');

class BluettiApp {
  constructor() {
    this.mainWindow = null;
    this.bluetoothManager = null;
    this.logger = new Logger();
    this.isDev = process.argv.includes('--dev');
  }

  async initialize() {
    // Initialize Bluetooth manager
    this.bluetoothManager = new BluetoothManager();
    
    // Set up IPC handlers
    this.setupIpcHandlers();
    
    // Create main window when app is ready
    app.whenReady().then(() => {
      this.createMainWindow();
      
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createMainWindow();
        }
      });
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('before-quit', () => {
      if (this.bluetoothManager) {
        this.bluetoothManager.cleanup();
      }
    });
  }

  createMainWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      icon: path.join(__dirname, 'assets', 'icon.png'),
      titleBarStyle: 'default',
      show: false
    });

    // Load the main HTML file
    this.mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

    // Show window when ready
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
      
      if (this.isDev) {
        this.mainWindow.webContents.openDevTools();
      }
    });

    // Handle window closed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  setupIpcHandlers() {
    // Device scanning
    ipcMain.handle('bluetooth:scan', async () => {
      try {
        this.logger.info('Starting Bluetooth scan...');
        const devices = await this.bluetoothManager.scanForDevices();
        return { success: true, devices };
      } catch (error) {
        this.logger.error('Bluetooth scan failed:', error);
        return { success: false, error: error.message };
      }
    });

    // Device connection
    ipcMain.handle('bluetooth:connect', async (event, deviceId) => {
      try {
        this.logger.info(`Connecting to device: ${deviceId}`);
        const result = await this.bluetoothManager.connectToDevice(deviceId);
        return { success: true, result };
      } catch (error) {
        this.logger.error('Device connection failed:', error);
        return { success: false, error: error.message };
      }
    });

    // Device disconnection
    ipcMain.handle('bluetooth:disconnect', async (event, deviceId) => {
      try {
        this.logger.info(`Disconnecting from device: ${deviceId}`);
        await this.bluetoothManager.disconnectDevice(deviceId);
        return { success: true };
      } catch (error) {
        this.logger.error('Device disconnection failed:', error);
        return { success: false, error: error.message };
      }
    });

    // Get device data
    ipcMain.handle('device:getData', async (event, deviceId) => {
      try {
        const data = await this.bluetoothManager.getDeviceData(deviceId);
        return { success: true, data };
      } catch (error) {
        this.logger.error('Failed to get device data:', error);
        return { success: false, error: error.message };
      }
    });

    // Get connected devices
    ipcMain.handle('device:getConnected', async () => {
      try {
        const devices = this.bluetoothManager.getConnectedDevices();
        return { success: true, devices };
      } catch (error) {
        this.logger.error('Failed to get connected devices:', error);
        return { success: false, error: error.message };
      }
    });
  }

  sendToRenderer(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }
}

// Create and initialize the app
const bluettiApp = new BluettiApp();
bluettiApp.initialize().catch(error => {
  console.error('Failed to initialize app:', error);
  app.quit();
});

// Export for potential testing
module.exports = BluettiApp;

