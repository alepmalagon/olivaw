const noble = require('@abandonware/noble');
const EventEmitter = require('events');
const Logger = require('../utils/logger');
const BluettiDevice = require('./device');

class BluetoothManager extends EventEmitter {
  constructor() {
    super();
    this.logger = new Logger();
    this.devices = new Map(); // Map of device ID to BluettiDevice instances
    this.scanning = false;
    this.scanTimeout = null;
    
    // Bluetti service UUIDs and characteristics
    this.BLUETTI_SERVICE_UUID = '0000ff00-0000-1000-8000-00805f9b34fb';
    this.BLUETTI_WRITE_CHAR_UUID = '0000ff02-0000-1000-8000-00805f9b34fb';
    this.BLUETTI_NOTIFY_CHAR_UUID = '0000ff01-0000-1000-8000-00805f9b34fb';
    
    this.initialize();
  }

  initialize() {
    noble.on('stateChange', (state) => {
      this.logger.info(`Bluetooth state changed: ${state}`);
      
      if (state === 'poweredOn') {
        this.emit('ready');
      } else {
        this.logger.warn('Bluetooth not available');
        if (this.scanning) {
          this.stopScanning();
        }
      }
    });

    noble.on('discover', (peripheral) => {
      this.handleDeviceDiscovered(peripheral);
    });
  }

  async scanForDevices(timeout = 10000) {
    return new Promise((resolve, reject) => {
      if (this.scanning) {
        reject(new Error('Scan already in progress'));
        return;
      }

      if (noble.state !== 'poweredOn') {
        reject(new Error('Bluetooth not ready'));
        return;
      }

      const discoveredDevices = [];
      this.scanning = true;

      // Set up discovery handler
      const onDiscover = (peripheral) => {
        if (this.isBluettiDevice(peripheral)) {
          const deviceInfo = {
            id: peripheral.id,
            name: peripheral.advertisement.localName || 'Unknown Bluetti Device',
            address: peripheral.address,
            rssi: peripheral.rssi,
            connectable: peripheral.connectable
          };
          
          discoveredDevices.push(deviceInfo);
          this.logger.info(`Found Bluetti device: ${deviceInfo.name} (${deviceInfo.address})`);
        }
      };

      noble.on('discover', onDiscover);

      // Start scanning
      noble.startScanning([this.BLUETTI_SERVICE_UUID], false);
      this.logger.info('Started scanning for Bluetti devices...');

      // Set timeout
      this.scanTimeout = setTimeout(() => {
        noble.removeListener('discover', onDiscover);
        this.stopScanning();
        resolve(discoveredDevices);
      }, timeout);
    });
  }

  stopScanning() {
    if (this.scanning) {
      noble.stopScanning();
      this.scanning = false;
      
      if (this.scanTimeout) {
        clearTimeout(this.scanTimeout);
        this.scanTimeout = null;
      }
      
      this.logger.info('Stopped scanning');
    }
  }

  isBluettiDevice(peripheral) {
    // Check if device advertises Bluetti service
    const services = peripheral.advertisement.serviceUuids || [];
    if (services.includes(this.BLUETTI_SERVICE_UUID)) {
      return true;
    }

    // Check device name patterns
    const name = peripheral.advertisement.localName || '';
    const bluettiPatterns = [
      /^AC\d+/i,      // AC series (AC200P, AC300, etc.)
      /^EB\d+/i,      // EB series (EB150, EB240, etc.)
      /^EP\d+/i,      // EP series (EP500, EP600, etc.)
      /^B\d+/i,       // B series (B230, B300, etc.)
      /bluetti/i      // Generic Bluetti name
    ];

    return bluettiPatterns.some(pattern => pattern.test(name));
  }

  async connectToDevice(deviceId) {
    try {
      // Find the peripheral
      const peripheral = noble._peripherals[deviceId];
      if (!peripheral) {
        throw new Error(`Device ${deviceId} not found`);
      }

      // Create device instance
      const device = new BluettiDevice(peripheral, {
        serviceUuid: this.BLUETTI_SERVICE_UUID,
        writeCharUuid: this.BLUETTI_WRITE_CHAR_UUID,
        notifyCharUuid: this.BLUETTI_NOTIFY_CHAR_UUID
      });

      // Connect to device
      await device.connect();
      
      // Store device
      this.devices.set(deviceId, device);
      
      // Set up event handlers
      device.on('data', (data) => {
        this.emit('deviceData', deviceId, data);
      });

      device.on('disconnected', () => {
        this.devices.delete(deviceId);
        this.emit('deviceDisconnected', deviceId);
      });

      this.logger.info(`Successfully connected to device: ${deviceId}`);
      this.emit('deviceConnected', deviceId);
      
      return device.getDeviceInfo();
    } catch (error) {
      this.logger.error(`Failed to connect to device ${deviceId}:`, error);
      throw error;
    }
  }

  async disconnectDevice(deviceId) {
    const device = this.devices.get(deviceId);
    if (device) {
      await device.disconnect();
      this.devices.delete(deviceId);
      this.logger.info(`Disconnected from device: ${deviceId}`);
    }
  }

  async getDeviceData(deviceId) {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not connected`);
    }

    return await device.getData();
  }

  getConnectedDevices() {
    const connectedDevices = [];
    for (const [deviceId, device] of this.devices) {
      if (device.isConnected()) {
        connectedDevices.push({
          id: deviceId,
          info: device.getDeviceInfo(),
          lastData: device.getLastData()
        });
      }
    }
    return connectedDevices;
  }

  handleDeviceDiscovered(peripheral) {
    if (this.isBluettiDevice(peripheral)) {
      this.emit('deviceDiscovered', {
        id: peripheral.id,
        name: peripheral.advertisement.localName || 'Unknown Bluetti Device',
        address: peripheral.address,
        rssi: peripheral.rssi
      });
    }
  }

  cleanup() {
    this.logger.info('Cleaning up Bluetooth manager...');
    
    // Stop scanning
    this.stopScanning();
    
    // Disconnect all devices
    const disconnectPromises = Array.from(this.devices.keys()).map(deviceId => 
      this.disconnectDevice(deviceId).catch(err => 
        this.logger.error(`Error disconnecting device ${deviceId}:`, err)
      )
    );
    
    return Promise.all(disconnectPromises);
  }
}

module.exports = BluetoothManager;

