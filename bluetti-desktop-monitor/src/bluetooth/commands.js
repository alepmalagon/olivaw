/**
 * MODBUS commands for Bluetti devices
 * Based on the bluetti_mqtt Python library implementation
 */
class ModbusCommands {
  constructor() {
    // MODBUS function codes
    this.READ_HOLDING_REGISTERS = 0x03;
    this.READ_INPUT_REGISTERS = 0x04;
    
    // Common register addresses (these would need to be verified/updated based on actual protocol)
    this.REGISTERS = {
      BATTERY_LEVEL: 0x0100,
      POWER_INPUT: 0x0101,
      POWER_OUTPUT: 0x0102,
      CHARGING_STATUS: 0x0103,
      DEVICE_MODEL: 0x0200,
      SERIAL_NUMBER: 0x0201,
      FIRMWARE_VERSION: 0x0202
    };
  }

  /**
   * Create a MODBUS command buffer
   * @param {number} functionCode - MODBUS function code
   * @param {number} startAddress - Starting register address
   * @param {number} quantity - Number of registers to read
   * @returns {Buffer} Command buffer
   */
  createCommand(functionCode, startAddress, quantity = 1) {
    const buffer = Buffer.alloc(8);
    let offset = 0;
    
    // Device address (usually 0x01 for Bluetti)
    buffer.writeUInt8(0x01, offset++);
    
    // Function code
    buffer.writeUInt8(functionCode, offset++);
    
    // Starting address (big-endian)
    buffer.writeUInt16BE(startAddress, offset);
    offset += 2;
    
    // Quantity of registers (big-endian)
    buffer.writeUInt16BE(quantity, offset);
    offset += 2;
    
    // Calculate CRC16
    const crc = this.calculateCRC16(buffer.slice(0, offset));
    buffer.writeUInt16LE(crc, offset); // CRC is little-endian
    
    return buffer;
  }

  /**
   * Calculate CRC16 for MODBUS
   * @param {Buffer} buffer - Data buffer
   * @returns {number} CRC16 value
   */
  calculateCRC16(buffer) {
    let crc = 0xFFFF;
    
    for (let i = 0; i < buffer.length; i++) {
      crc ^= buffer[i];
      
      for (let j = 0; j < 8; j++) {
        if (crc & 0x0001) {
          crc = (crc >> 1) ^ 0xA001;
        } else {
          crc = crc >> 1;
        }
      }
    }
    
    return crc;
  }

  /**
   * Parse MODBUS response
   * @param {Buffer} response - Response buffer
   * @returns {Object} Parsed data
   */
  parseResponse(response) {
    if (response.length < 5) {
      throw new Error('Response too short');
    }

    const deviceAddress = response.readUInt8(0);
    const functionCode = response.readUInt8(1);
    
    // Check for error response
    if (functionCode & 0x80) {
      const errorCode = response.readUInt8(2);
      throw new Error(`MODBUS error: ${errorCode}`);
    }

    // Verify CRC
    const dataLength = response.length - 2;
    const receivedCRC = response.readUInt16LE(dataLength);
    const calculatedCRC = this.calculateCRC16(response.slice(0, dataLength));
    
    if (receivedCRC !== calculatedCRC) {
      throw new Error('CRC mismatch');
    }

    // Parse data based on function code
    if (functionCode === this.READ_HOLDING_REGISTERS || functionCode === this.READ_INPUT_REGISTERS) {
      const byteCount = response.readUInt8(2);
      const data = response.slice(3, 3 + byteCount);
      
      return this.parseRegisterData(data);
    }

    return null;
  }

  /**
   * Parse register data into meaningful values
   * @param {Buffer} data - Register data
   * @returns {Object} Parsed values
   */
  parseRegisterData(data) {
    const result = {};
    
    // This is a simplified parser - actual implementation would depend on
    // the specific register layout for each Bluetti model
    if (data.length >= 2) {
      // Assume first register is battery level (0-100%)
      result.batteryLevel = data.readUInt16BE(0);
    }
    
    if (data.length >= 4) {
      // Assume second register is power input (watts)
      result.powerInput = data.readUInt16BE(2);
    }
    
    if (data.length >= 6) {
      // Assume third register is power output (watts)
      result.powerOutput = data.readUInt16BE(4);
    }
    
    if (data.length >= 8) {
      // Assume fourth register is charging status
      const status = data.readUInt16BE(6);
      result.chargingStatus = this.parseChargingStatus(status);
    }
    
    return result;
  }

  /**
   * Parse charging status from register value
   * @param {number} value - Status register value
   * @returns {string} Status string
   */
  parseChargingStatus(value) {
    switch (value) {
      case 0: return 'idle';
      case 1: return 'charging';
      case 2: return 'discharging';
      default: return 'unknown';
    }
  }

  // Command generators
  getBatteryLevel() {
    return this.createCommand(this.READ_HOLDING_REGISTERS, this.REGISTERS.BATTERY_LEVEL);
  }

  getPowerData() {
    // Read multiple registers starting from power input
    return this.createCommand(this.READ_HOLDING_REGISTERS, this.REGISTERS.POWER_INPUT, 3);
  }

  getDeviceModel() {
    return this.createCommand(this.READ_HOLDING_REGISTERS, this.REGISTERS.DEVICE_MODEL);
  }

  getSerialNumber() {
    return this.createCommand(this.READ_HOLDING_REGISTERS, this.REGISTERS.SERIAL_NUMBER);
  }

  getFirmwareVersion() {
    return this.createCommand(this.READ_HOLDING_REGISTERS, this.REGISTERS.FIRMWARE_VERSION);
  }

  getAllData() {
    // Read all basic data registers in one command
    return this.createCommand(this.READ_HOLDING_REGISTERS, this.REGISTERS.BATTERY_LEVEL, 4);
  }
}

module.exports = ModbusCommands;

