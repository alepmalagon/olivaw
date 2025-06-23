// Main renderer process script
class BluettiMonitorApp {
  constructor() {
    this.currentDevice = null;
    this.dataUpdateInterval = null;
    this.discoveredDevices = [];
    
    this.initializeElements();
    this.setupEventListeners();
    this.setupElectronListeners();
  }

  initializeElements() {
    // Buttons
    this.scanBtn = document.getElementById('scanBtn');
    this.refreshBtn = document.getElementById('refreshBtn');
    this.disconnectBtn = document.getElementById('disconnectBtn');
    
    // Sections
    this.discoverySection = document.getElementById('discoverySection');
    this.connectedSection = document.getElementById('connectedSection');
    this.monitorSection = document.getElementById('monitorSection');
    
    // Device list
    this.deviceList = document.getElementById('deviceList');
    this.emptyState = document.getElementById('emptyState');
    this.scanningIndicator = document.getElementById('scanningIndicator');
    
    // Monitor elements
    this.batteryLevel = document.getElementById('batteryLevel');
    this.batteryFill = document.getElementById('batteryFill');
    this.powerInput = document.getElementById('powerInput');
    this.powerOutput = document.getElementById('powerOutput');
    this.chargingStatus = document.getElementById('chargingStatus');
    this.lastUpdate = document.getElementById('lastUpdate');
    
    // Device info
    this.deviceModel = document.getElementById('deviceModel');
    this.deviceSerial = document.getElementById('deviceSerial');
    this.deviceFirmware = document.getElementById('deviceFirmware');
    this.deviceAddress = document.getElementById('deviceAddress');
    this.monitorTitle = document.getElementById('monitorTitle');
    
    // Status
    this.connectionStatus = document.getElementById('connectionStatus');
    
    // Toasts
    this.errorToast = document.getElementById('errorToast');
    this.successToast = document.getElementById('successToast');
    this.errorMessage = document.getElementById('errorMessage');
    this.successMessage = document.getElementById('successMessage');
  }

  setupEventListeners() {
    // Scan button
    this.scanBtn.addEventListener('click', () => this.scanForDevices());
    
    // Refresh button
    this.refreshBtn.addEventListener('click', () => this.refreshDeviceData());
    
    // Disconnect button
    this.disconnectBtn.addEventListener('click', () => this.disconnectCurrentDevice());
    
    // Toast close buttons
    document.getElementById('closeErrorToast').addEventListener('click', () => {
      this.errorToast.style.display = 'none';
    });
    
    document.getElementById('closeSuccessToast').addEventListener('click', () => {
      this.successToast.style.display = 'none';
    });
  }

  setupElectronListeners() {
    // Listen for device data updates
    window.electronAPI.on('device:dataUpdate', (event, deviceId, data) => {
      if (deviceId === this.currentDevice?.id) {
        this.updateMonitorDisplay(data);
      }
    });

    // Listen for device connection events
    window.electronAPI.on('device:connected', (event, deviceId) => {
      this.showSuccessToast(`Connected to device ${deviceId}`);
      this.updateConnectionStatus(true);
    });

    window.electronAPI.on('device:disconnected', (event, deviceId) => {
      if (deviceId === this.currentDevice?.id) {
        this.showErrorToast(`Disconnected from device ${deviceId}`);
        this.updateConnectionStatus(false);
        this.showDiscoverySection();
      }
    });

    // Listen for errors
    window.electronAPI.on('app:error', (event, error) => {
      this.showErrorToast(error.message || 'An error occurred');
    });
  }

  async scanForDevices() {
    try {
      this.setScanningState(true);
      this.showDiscoverySection();
      
      const result = await window.electronAPI.bluetooth.scan();
      
      if (result.success) {
        this.discoveredDevices = result.devices;
        this.displayDiscoveredDevices(result.devices);
        
        if (result.devices.length === 0) {
          this.showErrorToast('No Bluetti devices found. Make sure your device is nearby and in pairing mode.');
        } else {
          this.showSuccessToast(`Found ${result.devices.length} device(s)`);
        }
      } else {
        this.showErrorToast(result.error || 'Failed to scan for devices');
      }
    } catch (error) {
      this.showErrorToast('Scan failed: ' + error.message);
    } finally {
      this.setScanningState(false);
    }
  }

  setScanningState(scanning) {
    this.scanBtn.disabled = scanning;
    this.scanBtn.innerHTML = scanning ? 
      '<span class="spinner"></span> Scanning...' : 
      '<span class="btn-icon">🔍</span> Scan Devices';
    
    this.scanningIndicator.style.display = scanning ? 'flex' : 'none';
    this.emptyState.style.display = scanning ? 'none' : 
      (this.discoveredDevices.length === 0 ? 'block' : 'none');
  }

  displayDiscoveredDevices(devices) {
    if (devices.length === 0) {
      this.emptyState.style.display = 'block';
      return;
    }

    this.emptyState.style.display = 'none';
    
    // Clear existing devices
    const existingCards = this.deviceList.querySelectorAll('.device-card');
    existingCards.forEach(card => card.remove());

    // Add device cards
    devices.forEach(device => {
      const deviceCard = this.createDeviceCard(device);
      this.deviceList.appendChild(deviceCard);
    });
  }

  createDeviceCard(device) {
    const card = document.createElement('div');
    card.className = 'device-card';
    card.innerHTML = `
      <div class="device-card-header">
        <div>
          <div class="device-name">${device.name}</div>
          <div class="device-address">${device.address}</div>
        </div>
        <div class="device-signal">
          <span>${device.rssi} dBm</span>
          <div class="signal-strength ${this.getSignalStrength(device.rssi)}"></div>
        </div>
      </div>
      <div class="device-actions">
        <button class="btn btn-primary connect-btn" data-device-id="${device.id}">
          <span class="btn-icon">🔗</span>
          Connect
        </button>
      </div>
    `;

    // Add connect button listener
    const connectBtn = card.querySelector('.connect-btn');
    connectBtn.addEventListener('click', () => this.connectToDevice(device));

    return card;
  }

  getSignalStrength(rssi) {
    if (rssi > -50) return 'strong';
    if (rssi > -70) return 'medium';
    return 'weak';
  }

  async connectToDevice(device) {
    try {
      const connectBtn = document.querySelector(`[data-device-id="${device.id}"]`);
      connectBtn.disabled = true;
      connectBtn.innerHTML = '<span class="spinner"></span> Connecting...';

      const result = await window.electronAPI.bluetooth.connect(device.id);
      
      if (result.success) {
        this.currentDevice = {
          id: device.id,
          info: result.result,
          ...device
        };
        
        this.showMonitorSection();
        this.updateDeviceInfo(this.currentDevice);
        this.startDataUpdates();
        
        this.showSuccessToast(`Connected to ${device.name}`);
        this.updateConnectionStatus(true);
      } else {
        this.showErrorToast(result.error || 'Failed to connect to device');
        connectBtn.disabled = false;
        connectBtn.innerHTML = '<span class="btn-icon">🔗</span> Connect';
      }
    } catch (error) {
      this.showErrorToast('Connection failed: ' + error.message);
    }
  }

  async disconnectCurrentDevice() {
    if (!this.currentDevice) return;

    try {
      const result = await window.electronAPI.bluetooth.disconnect(this.currentDevice.id);
      
      if (result.success) {
        this.stopDataUpdates();
        this.currentDevice = null;
        this.updateConnectionStatus(false);
        this.showDiscoverySection();
        this.showSuccessToast('Device disconnected');
      } else {
        this.showErrorToast(result.error || 'Failed to disconnect device');
      }
    } catch (error) {
      this.showErrorToast('Disconnect failed: ' + error.message);
    }
  }

  async refreshDeviceData() {
    if (!this.currentDevice) return;

    try {
      this.refreshBtn.disabled = true;
      this.refreshBtn.innerHTML = '<span class="spinner"></span> Refreshing...';

      const result = await window.electronAPI.device.getData(this.currentDevice.id);
      
      if (result.success) {
        this.updateMonitorDisplay(result.data);
        this.showSuccessToast('Data refreshed');
      } else {
        this.showErrorToast(result.error || 'Failed to refresh data');
      }
    } catch (error) {
      this.showErrorToast('Refresh failed: ' + error.message);
    } finally {
      this.refreshBtn.disabled = false;
      this.refreshBtn.innerHTML = '<span class="btn-icon">🔄</span> Refresh';
    }
  }

  startDataUpdates() {
    // Update data every 5 seconds
    this.dataUpdateInterval = setInterval(() => {
      this.refreshDeviceData();
    }, 5000);
  }

  stopDataUpdates() {
    if (this.dataUpdateInterval) {
      clearInterval(this.dataUpdateInterval);
      this.dataUpdateInterval = null;
    }
  }

  updateMonitorDisplay(data) {
    if (!data) return;

    // Update battery level
    if (data.batteryLevel !== null && data.batteryLevel !== undefined) {
      this.batteryLevel.textContent = `${data.batteryLevel}%`;
      this.batteryFill.style.width = `${data.batteryLevel}%`;
      
      // Update battery color based on level
      this.batteryFill.className = 'battery-fill';
      if (data.batteryLevel < 20) {
        this.batteryFill.classList.add('low');
      } else if (data.batteryLevel < 50) {
        this.batteryFill.classList.add('medium');
      }
    }

    // Update power input
    if (data.powerInput !== null && data.powerInput !== undefined) {
      this.powerInput.textContent = `${data.powerInput} W`;
    }

    // Update power output
    if (data.powerOutput !== null && data.powerOutput !== undefined) {
      this.powerOutput.textContent = `${data.powerOutput} W`;
    }

    // Update charging status
    if (data.chargingStatus) {
      this.chargingStatus.textContent = data.chargingStatus;
      this.chargingStatus.className = `status-badge ${data.chargingStatus}`;
    }

    // Update last update time
    if (data.timestamp) {
      const time = new Date(data.timestamp).toLocaleTimeString();
      this.lastUpdate.textContent = time;
    }
  }

  updateDeviceInfo(device) {
    this.monitorTitle.textContent = `${device.name} Monitor`;
    this.deviceModel.textContent = device.info?.model || 'Unknown';
    this.deviceSerial.textContent = device.info?.serialNumber || 'Unknown';
    this.deviceFirmware.textContent = device.info?.firmwareVersion || 'Unknown';
    this.deviceAddress.textContent = device.address || 'Unknown';
  }

  updateConnectionStatus(connected) {
    const statusIndicator = this.connectionStatus.querySelector('.status-indicator');
    const statusText = this.connectionStatus.querySelector('.status-text');
    
    if (connected) {
      statusIndicator.classList.add('connected');
      statusText.textContent = 'Connected';
    } else {
      statusIndicator.classList.remove('connected');
      statusText.textContent = 'Disconnected';
    }
  }

  showDiscoverySection() {
    this.discoverySection.style.display = 'block';
    this.connectedSection.style.display = 'none';
    this.monitorSection.style.display = 'none';
  }

  showMonitorSection() {
    this.discoverySection.style.display = 'none';
    this.connectedSection.style.display = 'none';
    this.monitorSection.style.display = 'block';
  }

  showErrorToast(message) {
    this.errorMessage.textContent = message;
    this.errorToast.style.display = 'flex';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.errorToast.style.display = 'none';
    }, 5000);
  }

  showSuccessToast(message) {
    this.successMessage.textContent = message;
    this.successToast.style.display = 'flex';
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      this.successToast.style.display = 'none';
    }, 3000);
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new BluettiMonitorApp();
});

