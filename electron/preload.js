'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Only these narrow, data-only channels are exposed to the renderer.
// No Node.js API, no ipcRenderer object, no arbitrary filesystem access.
contextBridge.exposeInMainWorld('desktop', {
  loadClientData: () => ipcRenderer.invoke('clients:load'),
  resolveClient: (input) => ipcRenderer.invoke('clients:resolve', input),
  saveData: (payload) => ipcRenderer.invoke('data:save', payload),
  getDataPath: () => ipcRenderer.invoke('data:path'),
  revealDataFile: () => ipcRenderer.invoke('data:reveal'),
  exportBackup: (payload) => ipcRenderer.invoke('backup:export', payload),
  importBackup: () => ipcRenderer.invoke('backup:import'),
  exportCsv: (csv, suggestedName) => ipcRenderer.invoke('csv:export', csv, suggestedName),
  pickAssets: () => ipcRenderer.invoke('assets:pick'),
  openTarget: (target) => ipcRenderer.invoke('shell:open', target),
  appVersion: () => ipcRenderer.invoke('app:version'),
  gsheetReadRows: (spreadsheetId, range) => ipcRenderer.invoke('gsheet:read-rows', spreadsheetId, range),
  clientsList: () => ipcRenderer.invoke('clients:list'),
  clientsActive: () => ipcRenderer.invoke('clients:active'),
  clientsSelect: (id) => ipcRenderer.invoke('clients:select', id),
  clientsCreate: (name) => ipcRenderer.invoke('clients:create', name),
  clientsRename: (id, name) => ipcRenderer.invoke('clients:rename', id, name),
  clientsDelete: (id) => ipcRenderer.invoke('clients:delete', id),
});
