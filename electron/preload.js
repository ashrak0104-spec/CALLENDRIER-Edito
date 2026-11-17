'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Only these narrow, data-only channels are exposed to the renderer.
// No Node.js API, no ipcRenderer object, no arbitrary filesystem access.
contextBridge.exposeInMainWorld('desktop', {
  loadData: () => ipcRenderer.invoke('data:load'),
  saveData: (payload) => ipcRenderer.invoke('data:save', payload),
  getDataPath: () => ipcRenderer.invoke('data:path'),
  revealDataFile: () => ipcRenderer.invoke('data:reveal'),
  exportBackup: (payload) => ipcRenderer.invoke('backup:export', payload),
  importBackup: () => ipcRenderer.invoke('backup:import'),
  exportCsv: (csv, suggestedName) => ipcRenderer.invoke('csv:export', csv, suggestedName),
  pickAssets: () => ipcRenderer.invoke('assets:pick'),
  openTarget: (target) => ipcRenderer.invoke('shell:open', target),
  appVersion: () => ipcRenderer.invoke('app:version'),
  authStatus: () => ipcRenderer.invoke('auth:status'),
  authRequestCode: (email) => ipcRenderer.invoke('auth:request-code', email),
  authVerify: (email, code) => ipcRenderer.invoke('auth:verify', email, code),
  authLogout: () => ipcRenderer.invoke('auth:logout'),
  authConfig: () => ipcRenderer.invoke('auth:config'),
  authConfigure: (config) => ipcRenderer.invoke('auth:configure', config),
});
