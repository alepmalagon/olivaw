const fs = require('fs');
const path = require('path');

class Logger {
  constructor(options = {}) {
    this.logLevel = options.logLevel || 'info';
    this.logToFile = options.logToFile !== false; // Default to true
    this.logToConsole = options.logToConsole !== false; // Default to true
    
    // Create logs directory if it doesn't exist
    this.logDir = path.join(process.cwd(), 'logs');
    if (this.logToFile && !fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    
    this.logFile = path.join(this.logDir, `bluetti-${this.getDateString()}.log`);
    
    // Log levels
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
  }

  getDateString() {
    const now = new Date();
    return now.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  getTimestamp() {
    return new Date().toISOString();
  }

  shouldLog(level) {
    return this.levels[level] <= this.levels[this.logLevel];
  }

  formatMessage(level, message, ...args) {
    const timestamp = this.getTimestamp();
    const formattedArgs = args.map(arg => {
      if (typeof arg === 'object') {
        return JSON.stringify(arg, null, 2);
      }
      return String(arg);
    }).join(' ');
    
    return `[${timestamp}] [${level.toUpperCase()}] ${message} ${formattedArgs}`.trim();
  }

  writeToFile(formattedMessage) {
    if (this.logToFile) {
      try {
        fs.appendFileSync(this.logFile, formattedMessage + '\n');
      } catch (error) {
        console.error('Failed to write to log file:', error);
      }
    }
  }

  writeToConsole(level, formattedMessage) {
    if (this.logToConsole) {
      switch (level) {
        case 'error':
          console.error(formattedMessage);
          break;
        case 'warn':
          console.warn(formattedMessage);
          break;
        case 'debug':
          console.debug(formattedMessage);
          break;
        default:
          console.log(formattedMessage);
      }
    }
  }

  log(level, message, ...args) {
    if (!this.shouldLog(level)) {
      return;
    }

    const formattedMessage = this.formatMessage(level, message, ...args);
    
    this.writeToConsole(level, formattedMessage);
    this.writeToFile(formattedMessage);
  }

  error(message, ...args) {
    this.log('error', message, ...args);
  }

  warn(message, ...args) {
    this.log('warn', message, ...args);
  }

  info(message, ...args) {
    this.log('info', message, ...args);
  }

  debug(message, ...args) {
    this.log('debug', message, ...args);
  }

  // Utility method to log errors with stack traces
  logError(error, context = '') {
    const message = context ? `${context}: ${error.message}` : error.message;
    this.error(message);
    
    if (error.stack) {
      this.error('Stack trace:', error.stack);
    }
  }

  // Method to change log level at runtime
  setLogLevel(level) {
    if (this.levels.hasOwnProperty(level)) {
      this.logLevel = level;
      this.info(`Log level changed to: ${level}`);
    } else {
      this.warn(`Invalid log level: ${level}. Valid levels are: ${Object.keys(this.levels).join(', ')}`);
    }
  }

  // Method to rotate log files (call this daily or as needed)
  rotateLogFile() {
    const newLogFile = path.join(this.logDir, `bluetti-${this.getDateString()}.log`);
    if (newLogFile !== this.logFile) {
      this.info('Rotating log file');
      this.logFile = newLogFile;
    }
  }
}

module.exports = Logger;

