# Bluetti Desktop Monitor

A desktop application for monitoring Bluetti power stations via Bluetooth, built with Electron and Node.js.

## Features

- 🔍 **Device Discovery**: Scan for nearby Bluetti devices via Bluetooth
- 🔗 **Device Connection**: Connect to and manage multiple Bluetti power stations
- 📊 **Real-time Monitoring**: View battery level, power input/output, and charging status
- 💻 **Cross-platform**: Works on Windows, macOS, and Linux
- 🎨 **Modern UI**: Clean, responsive interface with real-time updates

## Screenshots

*Screenshots will be added once the app is running*

## Installation

### Prerequisites

- Node.js 16 or higher
- Bluetooth adapter (built-in or USB)
- Bluetti power station with Bluetooth capability

### Development Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd bluetti-desktop-monitor
```

2. Install dependencies:
```bash
npm install
```

3. Run in development mode:
```bash
npm run dev
```

### Building for Production

Build for your current platform:
```bash
npm run build
```

Build for specific platforms:
```bash
npm run build-win    # Windows
npm run build-mac    # macOS
npm run build-linux  # Linux
```

## Usage

1. **Launch the Application**: Start the app and ensure Bluetooth is enabled on your computer

2. **Scan for Devices**: Click "Scan Devices" to search for nearby Bluetti power stations

3. **Connect to Device**: Click "Connect" on any discovered device to establish a connection

4. **Monitor Your Device**: View real-time data including:
   - Battery percentage and visual indicator
   - Power input (charging watts)
   - Power output (load watts)
   - Current charging status
   - Device information

5. **Manage Connection**: Use the refresh button to update data manually or disconnect when done

## Supported Devices

This application should work with most Bluetti power stations that support Bluetooth connectivity, including:

- AC series (AC200P, AC300, AC500, etc.)
- EB series (EB150, EB240, etc.)
- EP series (EP500, EP600, etc.)
- B series (B230, B300, etc.)

*Note: Some older models may have limited Bluetooth functionality*

## Technical Details

### Architecture

- **Main Process**: Handles Bluetooth communication and device management
- **Renderer Process**: Manages the user interface and user interactions
- **IPC Communication**: Secure communication between processes using Electron's IPC

### Bluetooth Protocol

The app uses MODBUS-over-Bluetooth protocol to communicate with Bluetti devices, based on the reverse-engineered protocol from the [bluetti_mqtt](https://github.com/warhammerkid/bluetti_mqtt) project.

### Dependencies

- **Electron**: Desktop app framework
- **@abandonware/noble**: Bluetooth Low Energy library for Node.js
- **modbus-serial**: MODBUS protocol implementation

## Development

### Project Structure

```
src/
├── main.js              # Main Electron process
├── preload.js           # Preload script for secure IPC
├── bluetooth/
│   ├── manager.js       # Bluetooth device management
│   ├── device.js        # Individual device handling
│   └── commands.js      # MODBUS command implementation
├── renderer/
│   ├── index.html       # Main UI
│   ├── style.css        # Styling
│   └── renderer.js      # UI logic
└── utils/
    └── logger.js        # Logging utility
```

### Adding New Features

1. **Bluetooth Features**: Modify files in `src/bluetooth/`
2. **UI Features**: Update `src/renderer/` files
3. **Main Process**: Edit `src/main.js` for app-level functionality

### Debugging

- Run with `npm run dev` to enable developer tools
- Check logs in the `logs/` directory
- Use Electron DevTools for renderer process debugging

## Troubleshooting

### Common Issues

**Bluetooth not working:**
- Ensure Bluetooth is enabled on your system
- On Linux, you may need to run with sudo or configure permissions
- Check that your Bluetooth adapter supports BLE (Bluetooth Low Energy)

**Device not found:**
- Make sure your Bluetti device is in pairing mode
- Ensure the device is within Bluetooth range (typically 10 meters)
- Try restarting both the app and your Bluetti device

**Connection fails:**
- Check if another app is already connected to the device
- Restart the Bluetooth service on your computer
- Try moving closer to the device

### Platform-specific Notes

**Windows:**
- May require Visual Studio Build Tools for native modules
- Windows 10 version 1803 or later recommended for best Bluetooth support

**macOS:**
- Requires macOS 10.15 or later
- May need to grant Bluetooth permissions in System Preferences

**Linux:**
- Requires BlueZ 5.0 or later
- May need to install additional packages: `sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev`

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Commit your changes: `git commit -am 'Add new feature'`
5. Push to the branch: `git push origin feature-name`
6. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [bluetti_mqtt](https://github.com/warhammerkid/bluetti_mqtt) - For reverse-engineering the Bluetti Bluetooth protocol
- [noble](https://github.com/abandonware/noble) - For Bluetooth Low Energy support
- Bluetti community for device testing and feedback

## Disclaimer

This is an unofficial application and is not affiliated with or endorsed by Bluetti. Use at your own risk. The developers are not responsible for any damage to your devices or data loss.

