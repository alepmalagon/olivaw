const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Bluetooth operations
  bluetooth: {
    scan: () => ipcRenderer.invoke('bluetooth:scan'),
    connect: (deviceId) => ipcRenderer.invoke('bluetooth:connect', deviceId),
    disconnect: (deviceId) => ipcRenderer.invoke('bluetooth:disconnect', deviceId)
  },

  // Device operations
  device: {
    getData: (deviceId) => ipcRenderer.invoke('device:getData', deviceId),
    getConnected: () => ipcRenderer.invoke('device:getConnected')
  },

  // Event listeners
  on: (channel, callback) => {
    const validChannels = [
      'device:dataUpdate',
      'device:connected',
      'device:disconnected',
      'bluetooth:scanResult',
      'app:error'
    ];
    
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, callback);
    }
  },

  // Remove event listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

