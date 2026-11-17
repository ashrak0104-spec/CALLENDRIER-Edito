'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const clients = require('./clients');

const gsheetConfigPath = () => path.join(app.getPath('userData'), 'gsheet-config.json');

async function loadGsheetConfig() {
  try {
    return JSON.parse(await fs.readFile(gsheetConfigPath(), 'utf8'));
  } catch {
    return null;
  }
}

function readGsheetRows(google, spreadsheetId, range) {
  const request = { spreadsheetId, ranges: [range], valueRenderOption: 'UNFORMATTED_VALUE', dateTimeRenderOption: 'FORMATTED_STRING' };
  const response = google.sheets('v4').spreadsheets.values.batchGet(request);
  const batch = response.data.valueRanges || [];
  const rows = [];
  for (const entry of batch) {
    if (entry.values) {
      rows.push(entry.values);
    }
  }
  return { rows: flattenRows(rows) };
}

function flattenRows(blocks) {
  const out = [];
  for (const block of blocks) {
    for (const row of block) {
      out.push(row);
    }
  }
  return out;
}


/* Google Sheets : à compléter avec Google APIs

Ce module est à compléter avec le SDK googleapis pour lire les cellules
de la feuille configurée. Stocker les identifiants dans userData/gsheet-config.json.

// The product name is used to derive app.getPath('userData').
app.setName('Editorial Studio');

const DEV_URL = process.env.VITE_DEV_SERVER_URL;
let mainWindow = null;

function focusedWindow() {
  return BrowserWindow.getFocusedWindow() || mainWindow;
}

/** Write through a temporary file so an interrupted write never corrupts data. */
async function writeJsonFile(targetPath, payload) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  const tmpPath = `${targetPath}.tmp`;
  const json = JSON.stringify(payload, null, 2);
  await fs.writeFile(tmpPath, json, 'utf8');
  await fs.rename(tmpPath, targetPath);
}

async function readJsonFile(targetPath) {
  const raw = await fs.readFile(targetPath, 'utf8');
  return JSON.parse(raw);
}

const errorMessage = (error) =>
  error instanceof Error ? error.message : String(error ?? 'Erreur inconnue');

async function loadGsheetConfig() {
  try {
    return JSON.parse(await fs.readFile(gsheetConfigPath(), 'utf8'));
  } catch {
    return null;
  }
}

function readGsheetRows(google, spreadsheetId, range) {
  const request = { spreadsheetId, ranges: [range], valueRenderOption: 'UNFORMATTED_VALUE', dateTimeRenderOption: 'FORMATTED_STRING' };
  const response = google.sheets('v4').spreadsheets.values.batchGet(request);
  const batch = response.data.valueRanges || [];
  const rows = [];
  for (const entry of batch) {
    if (entry.values) {
      rows.push(entry.values);
    }
  }
  return { rows: flattenRows(rows) };
}

function flattenRows(blocks) {
  const out = [];
  for (const block of blocks) {
    for (const row of block) {
      out.push(row);
    }
  }
  return out;
}

const gsheetConfigPath = () => path.join(app.getPath('userData'), 'gsheet-config.json');

async function loadGsheetConfig() {
  try {
    return JSON.parse(await fs.readFile(gsheetConfigPath(), 'utf8'));
  } catch {
    return null;
  }
}

async async function loadGsheetTransport(config) {
  const { google } = require('googleapis');
  const { GoogleAuth } = require('google-auth-library');
  const auth = new GoogleAuth({ keyFile: config?.credentialsPath });
  const authClient = await auth.getClient();
  google.options.auth = authClient;
  return google;
}

/* ------------------------------------------------------------------ */
/* Lifecycle
function today() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 680,
    show: false,
    backgroundColor: '#0b1020',
    title: 'Editorial Studio',
    autoHideMenuBar: false,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  if (DEV_URL) {
    mainWindow.loadURL(DEV_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // External links open in the user's default browser, never inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = DEV_URL ? url.startsWith(DEV_URL) : url.startsWith('file://');
    if (!allowed) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/* ------------------------------------------------------------------ */
/* IPC : persistence                                                    */
/* ------------------------------------------------------------------ */

ipcMain.handle('data:save', async (_event, payload) => {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.items)) {
    throw new Error('Payload invalide : "items" doit être un tableau.');
  }
  const result = await clients.saveActiveData(payload);
  return { ok: true, path: result.path };
});

ipcMain.handle('data:path', async () => (await clients.currentDataPath()) ?? '');

ipcMain.handle('data:reveal', async () => {
  const file = await clients.currentDataPath();
  if (!file) {
    await shell.openPath(app.getPath('userData'));
    return;
  }
  try {
    await fs.access(file);
    shell.showItemInFolder(file);
  } catch {
    shell.openPath(app.getPath('userData'));
  }
});

/* ------------------------------------------------------------------ */
/* IPC : clients                                                        */
/* ------------------------------------------------------------------ */

ipcMain.handle('clients:list', () => clients.list());
ipcMain.handle('clients:load', () => clients.loadActive());

ipcMain.handle('clients:resolve', async (_event, input) => {
  try {
    return await clients.resolveActive(input);
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
});
ipcMain.handle('clients:active', () => clients.activeId());

ipcMain.handle('clients:select', async (_event, id) => {
  if (typeof id !== 'string' || !id) throw new Error('Identifiant client invalide.');
  return clients.select(id);
});

ipcMain.handle('clients:create', async (_event, name) => clients.create(name));

ipcMain.handle('clients:rename', async (_event, id, name) => {
  try {
    return { ok: true, client: await clients.rename(id, name) };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
});

ipcMain.handle('clients:delete', async (_event, id) => {
  try {
    return await clients.remove(id);
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
});

/* ------------------------------------------------------------------ */
/* IPC : backup / CSV                                                   */
/* ------------------------------------------------------------------ */

ipcMain.handle('backup:export', async (_event, payload) => {
  const result = await dialog.showSaveDialog(focusedWindow(), {
    title: 'Exporter une sauvegarde',
    defaultPath: path.join(app.getPath('documents'), `editorial-backup-${today()}.json`),
    filters: [{ name: 'Sauvegarde JSON', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  await writeJsonFile(result.filePath, payload);
  return { canceled: false, filePath: result.filePath };
});

ipcMain.handle('backup:import', async () => {
  const result = await dialog.showOpenDialog(focusedWindow(), {
    title: 'Restaurer une sauvegarde',
    properties: ['openFile'],
    filters: [{ name: 'Sauvegarde JSON', extensions: ['json'] }],
  });
  if (result.canceled || result.filePaths.length === 0) return { canceled: true };
  const filePath = result.filePaths[0];
  try {
    const data = await readJsonFile(filePath);
    return { canceled: false, filePath, data };
  } catch (error) {
    return {
      canceled: false,
      filePath,
      error: `Fichier illisible : ${error instanceof Error ? error.message : String(error)}`,
    };
  }
});

ipcMain.handle('csv:export', async (_event, csv, suggestedName) => {
  const result = await dialog.showSaveDialog(focusedWindow(), {
    title: 'Exporter le planning en CSV',
    defaultPath: path.join(
      app.getPath('documents'),
      typeof suggestedName === 'string' && suggestedName
        ? suggestedName
        : `planning-editorial-${today()}.csv`,
    ),
    filters: [{ name: 'Fichier CSV', extensions: ['csv'] }],
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  // BOM so Excel detects UTF-8 accents correctly.
  await fs.writeFile(result.filePath, `\uFEFF${String(csv ?? '')}`, 'utf8');
  return { canceled: false, filePath: result.filePath };
});

/* ------------------------------------------------------------------ */
/* IPC : files & shell                                                  */
/* ------------------------------------------------------------------ */

ipcMain.handle('assets:pick', async () => {
  const result = await dialog.showOpenDialog(focusedWindow(), {
    title: 'Joindre des fichiers',
    properties: ['openFile', 'multiSelections'],
  });
  if (result.canceled) return [];
  return result.filePaths;
});

ipcMain.handle('shell:open', async (_event, target) => {
  if (typeof target !== 'string' || target.trim() === '') return;
  if (/^https?:\/\//i.test(target)) {
    await shell.openExternal(target);
    return;
  }
  await shell.openPath(target);
});

ipcMain.handle('app:version', () => app.getVersion());

ipcMain.handle('gsheet:read-rows', async (_event, spreadsheetId, range) => {
  if (!spreadsheetId || typeof spreadsheetId !== 'string') {
    throw new Error('Identifiant de feuille manquant.');
  }
  if (!range || typeof range !== 'string') {
    throw new Error('Plage manquante.');
  }
  const config = await loadGsheetConfig();
  if (!config?.credentialsPath) {
    throw new Error('Compte Google non configuré.');
  }
  const transport = await loadGsheetTransport(config);
  return readGsheetRows(transport, spreadsheetId, range);
});

  if (!spreadsheetId || typeof spreadsheetId !== 'string') {
    throw new Error('Identifiant de feuille manquant.');
  }
  if (!range || typeof range !== 'string') {
    throw new Error('Plage manquante.');
  }
  const config = await loadGsheetConfig();
  if (!config?.credentialsPath) {
    throw new Error('Compte Google non configuré.');
  }
  const google = await loadGsheetTransport(config);
  return readGsheetRows(google, spreadsheetId, range);
});

/* ------------------------------------------------------------------ */
/* Lifecycle                                                            */
/* ------------------------------------------------------------------ */

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    app.setAppUserModelId('com.editorialstudio.app');
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
