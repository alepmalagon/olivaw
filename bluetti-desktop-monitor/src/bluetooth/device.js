const EventEmitter = require('events');
const Logger = require('../utils/logger');
const ModbusCommands = require('./commands');

class BluettiDevice extends EventEmitter {
  constructor(peripheral, config) {
    super();
    this.peripheral = peripheral;
    this.config = config;
    this.logger = new Logger();
    
    this.connected = false;
    this.service = null;
    this.writeCharacteristic = null;
    this.notifyCharacteristic = null;
    
    this.deviceInfo = {
      id: peripheral.id,
      name: peripheral.advertisement.localName || 'Unknown Bluetti Device',
      address: peripheral.address,
      model: null,
      serialNumber: null,
      firmwareVersion: null
    };
    
    this.lastData = {
      batteryLevel: null,
      powerInput: null,
      powerOutput: null,
      chargingStatus: null,
      timestamp: null
    };
    
    this.modbus = new ModbusCommands();
    this.setupPeripheralHandlers();
  }

  setupPeripheralHandlers() {
    this.peripheral.on('connect', () => {
      this.logger.info(`Connected to ${this.deviceInfo.name}`);
    });

    this.peripheral.on('disconnect', () => {
      this.logger.info(`Disconnected from ${this.deviceInfo.name}`);
      this.connected = false;
      this.emit('disconnected');
    });
  }

  async connect() {
    try {
      this.logger.info(`Connecting to ${this.deviceInfo.name}...`);
      
      // Connect to peripheral
      await this.connectPeripheral();
      
      // Discover services and characteristics
      await this.discoverServices();
      
      // Set up notifications
      await this.setupNotifications();
      
      // Get initial device info
      await this.getInitialDeviceInfo();
      
      this.connected = true;
      this.logger.info(`Successfully connected to ${this.deviceInfo.name}`);
      
    } catch (error) {
      this.logger.error(`Connection failed for ${this.deviceInfo.name}:`, error);
      throw error;
    }
  }

  async connectPeripheral() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      this.peripheral.connect((error) => {
        clearTimeout(timeout);
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  async discoverServices() {
    return new Promise((resolve, reject) => {
      this.peripheral.discoverServices([this.config.serviceUuid], (error, services) => {
        if (error) {
          reject(error);
          return;
        }

        if (services.length === 0) {
          reject(new Error('Bluetti service not found'));
          return;
        }

        this.service = services[0];
        
        // Discover characteristics
        this.service.discoverCharacteristics(
          [this.config.writeCharUuid, this.config.notifyCharUuid],
          (error, characteristics) => {
            if (error) {
              reject(error);
              return;
            }

            // Find write and notify characteristics
            for (const char of characteristics) {
              if (char.uuid === this.config.writeCharUuid) {
                this.writeCharacteristic = char;
              } else if (char.uuid === this.config.notifyCharUuid) {
                this.notifyCharacteristic = char;
              }
            }

            if (!this.writeCharacteristic || !this.notifyCharacteristic) {
              reject(new Error('Required characteristics not found'));
              return;
            }

            resolve();
          }
        );
      });
    });
  }

  async setupNotifications() {
    return new Promise((resolve, reject) => {
      // Subscribe to notifications
      this.notifyCharacteristic.subscribe((error) => {
        if (error) {
          reject(error);
          return;
        }

        // Handle incoming data
        this.notifyCharacteristic.on('data', (data) => {
          this.handleIncomingData(data);
        });

        resolve();
      });
    });
  }

  async getInitialDeviceInfo() {
    try {
      // Try to get device model and serial number
      const modelData = await this.sendCommand(this.modbus.getDeviceModel());
      if (modelData) {
        this.deviceInfo.model = this.parseDeviceModel(modelData);
      }

      const serialData = await this.sendCommand(this.modbus.getSerialNumber());
      if (serialData) {
        this.deviceInfo.serialNumber = this.parseSerialNumber(serialData);
      }

      const firmwareData = await this.sendCommand(this.modbus.getFirmwareVersion());
      if (firmwareData) {
        this.deviceInfo.firmwareVersion = this.parseFirmwareVersion(firmwareData);
      }
    } catch (error) {
      this.logger.warn('Could not get complete device info:', error.message);
    }
  }

  async sendCommand(command) {
    return new Promise((resolve, reject) => {
      if (!this.writeCharacteristic) {
        reject(new Error('Device not connected'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Command timeout'));
      }, 5000);

      // Store resolve function for response handling
      this.pendingCommand = { resolve, reject, timeout };

      // Send command
      this.writeCharacteristic.write(command, false, (error) => {
        if (error) {
          clearTimeout(timeout);
          delete this.pendingCommand;
          reject(error);
        }
      });
    });
  }

  handleIncomingData(data) {
    try {
      // Parse MODBUS response
      const parsedData = this.modbus.parseResponse(data);
      
      if (this.pendingCommand) {
        // This is a response to a command
        clearTimeout(this.pendingCommand.timeout);
        this.pendingCommand.resolve(parsedData);
        delete this.pendingCommand;
      } else {
        // This is unsolicited data (notifications)
        this.updateDeviceData(parsedData);
      }
    } catch (error) {
      this.logger.error('Error parsing incoming data:', error);
      
      if (this.pendingCommand) {
        clearTimeout(this.pendingCommand.timeout);
        this.pendingCommand.reject(error);
        delete this.pendingCommand;
      }
    }
  }

  updateDeviceData(parsedData) {
    // Update last known data
    if (parsedData.batteryLevel !== undefined) {
      this.lastData.batteryLevel = parsedData.batteryLevel;
    }
    if (parsedData.powerInput !== undefined) {
      this.lastData.powerInput = parsedData.powerInput;
    }
    if (parsedData.powerOutput !== undefined) {
      this.lastData.powerOutput = parsedData.powerOutput;
    }
    if (parsedData.chargingStatus !== undefined) {
      this.lastData.chargingStatus = parsedData.chargingStatus;
    }
    
    this.lastData.timestamp = new Date();
    
    // Emit data event
    this.emit('data', this.lastData);
  }

  async getData() {
    try {
      // Request current data from device
      const batteryData = await this.sendCommand(this.modbus.getBatteryLevel());
      const powerData = await this.sendCommand(this.modbus.getPowerData());
      
      const currentData = {
        batteryLevel: this.parseBatteryLevel(batteryData),
        powerInput: this.parsePowerInput(powerData),
        powerOutput: this.parsePowerOutput(powerData),
        chargingStatus: this.parseChargingStatus(powerData),
        timestamp: new Date()
      };
      
      // Update last data
      this.lastData = { ...this.lastData, ...currentData };
      
      return currentData;
    } catch (error) {
      this.logger.error('Failed to get device data:', error);
      throw error;
    }
  }

  // Parsing methods (simplified - would need actual MODBUS protocol implementation)
  parseDeviceModel(data) {
    // Placeholder - implement based on actual MODBUS response format
    return 'AC200P'; // Example model
  }

  parseSerialNumber(data) {
    // Placeholder - implement based on actual MODBUS response format
    return 'AC200P123456789';
  }

  parseFirmwareVersion(data) {
    // Placeholder - implement based on actual MODBUS response format
    return '1.0.0';
  }

  parseBatteryLevel(data) {
    // Placeholder - implement based on actual MODBUS response format
    // This would parse the actual battery percentage from MODBUS data
    return Math.floor(Math.random() * 100); // Mock data for now
  }

  parsePowerInput(data) {
    // Placeholder - implement based on actual MODBUS response format
    return Math.floor(Math.random() * 1000); // Mock data for now
  }

  parsePowerOutput(data) {
    // Placeholder - implement based on actual MODBUS response format
    return Math.floor(Math.random() * 800); // Mock data for now
  }

  parseChargingStatus(data) {
    // Placeholder - implement based on actual MODBUS response format
    const statuses = ['charging', 'discharging', 'idle'];
    return statuses[Math.floor(Math.random() * statuses.length)];
  }

  async disconnect() {
    try {
      if (this.connected && this.peripheral.state === 'connected') {
        await new Promise((resolve) => {
          this.peripheral.disconnect((error) => {
            if (error) {
              this.logger.error('Disconnect error:', error);
            }
            resolve();
          });
        });
      }
      this.connected = false;
    } catch (error) {
      this.logger.error('Error during disconnect:', error);
      throw error;
    }
  }

  isConnected() {
    return this.connected && this.peripheral.state === 'connected';
  }

  getDeviceInfo() {
    return { ...this.deviceInfo };
  }

  getLastData() {
    return { ...this.lastData };
  }
}

module.exports = BluettiDevice;

