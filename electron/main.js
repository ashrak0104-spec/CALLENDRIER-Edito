'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const clients = require('./clients');
const gsheet = require('./gsheet');
const sheetSync = require('./sheet-sync');
const planningSync = require('./planning-sync');

// The product name is used to derive app.getPath('userData').
app.setName('Editorial Studio');

// Feuille de calcul livrée par défaut ; modifiable dans userData/gsheet-config.json.
const DEFAULT_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1GQ3zneSlcLgMIRIwvHOrgbL8FJ92jm08iu1qMkfvbKM/edit?usp=sharing';

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

/** Compte les valeurs d'un champ : utilisé dans les rapports d'import. */
function countBy(list, field) {
  return list.reduce((counts, entry) => {
    const key = String(entry[field] ?? '');
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

/* ------------------------------------------------------------------ */
/* Google Sheets                                                        */
/* ------------------------------------------------------------------ */

const userDataDir = () => app.getPath('userData');

/**
 * Crée userData/gsheet-config.json au premier lancement (feuille partagée par lien,
 * mode « public »). Remplacer `auth` par un compte de service ou un refresh token
 * OAuth donne accès aux feuilles privées ; voir electron/gsheet.js.
 */
async function ensureGsheetConfig() {
  try {
    await gsheet.ensureConfig(userDataDir(), { spreadsheetUrl: DEFAULT_SHEET_URL });
  } catch (error) {
    console.error('[gsheet] configuration par défaut impossible', error);
  }
}

/* ------------------------------------------------------------------ */
/* Lifecycle                                                            */
/* ------------------------------------------------------------------ */

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

ipcMain.handle('backups:open', async () => {
  const directory = path.join(userDataDir(), 'backups', 'scheduled');
  await fs.mkdir(directory, { recursive: true });
  const error = await shell.openPath(directory);
  if (error) throw new Error(`Impossible d’ouvrir les sauvegardes : ${error}`);
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
    const result = await clients.remove(id);
    // Le client vient de la feuille : sa clé est mémorisée pour qu'il ne soit pas
    // recréé au prochain import (docs/sync-google-sheets.md §5).
    if (result.ok && result.sheetKey) {
      try {
        await gsheet.addIgnored(userDataDir(), result.sheetKey);
      } catch (error) {
        console.error('[gsheet] clé non mémorisée', error);
      }
    }
    return result;
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
});

/* ------------------------------------------------------------------ */
/* IPC : calendrier d'un client ← sa feuille Google Sheets              */
/* ------------------------------------------------------------------ */

/** Responsable appliqué aux contenus importés sans colonne « Responsable ». */
const CALENDAR_ASSIGNEE = 'Studio éditorial';

ipcMain.handle('clients:set-sheet', async (_event, id, url) => {
  try {
    if (typeof id !== 'string' || !id) throw new Error('Identifiant client invalide.');
    return { ok: true, client: await clients.setSheet(id, url) };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
});

/**
 * Synchronise le calendrier d'un client avec les onglets de sa feuille (sens unique
 * feuille → application : aucune écriture Google). Le calendrier est remplacé ;
 * l'ancien fichier est conservé à côté.
 */
ipcMain.handle('clients:sync-calendar', async (_event, id) => {
  try {
    if (typeof id !== 'string' || !id) throw new Error('Identifiant client invalide.');
    const meta = (await clients.list()).find((client) => client.id === id);
    if (!meta) throw new Error('Client introuvable.');

    const config = await gsheet.loadConfig(userDataDir());
    const spreadsheetId = meta.sheetId || config?.spreadsheetId || '';
    if (!spreadsheetId) {
      throw new Error(
        'Aucune feuille liée à ce client : collez son lien Google Sheets, il sera mémorisé.',
      );
    }

    const tabs = [];
    const problems = [];
    for (const tab of planningSync.CALENDAR_TABS) {
      try {
        const { rows } = await gsheet.readRows(config ?? {}, spreadsheetId, `${tab}!A1:Z300`);
        tabs.push({ title: tab, rows });
      } catch (error) {
        problems.push(`${tab} : ${errorMessage(error)}`);
      }
    }
    if (tabs.length === 0) {
      throw new Error(problems.join(' · ') || 'Feuille illisible.');
    }

    const mapped = planningSync.mapTabs(tabs, {
      assignee: CALENDAR_ASSIGNEE,
      now: new Date().toISOString(),
    });
    const warnings = [...problems, ...mapped.problems];
    if (mapped.items.length === 0) {
      return {
        ok: false,
        error: `Aucun contenu reconnu dans la feuille.${
          warnings.length ? ` ${warnings.slice(0, 3).join(' · ')}` : ''
        }`,
      };
    }

    const written = await clients.replaceCalendar(id, mapped.items);
    return {
      ok: true,
      report: {
        items: mapped.items.length,
        days: mapped.days,
        platforms: countBy(mapped.items, 'platform'),
        warnings,
        backup: written.backup ?? null,
        sheetId: spreadsheetId,
      },
      clients: await clients.list(),
    };
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
      error: `Fichier illisible : ${errorMessage(error)}`,
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

/* ------------------------------------------------------------------ */
/* IPC : Google Sheets                                                  */
/* ------------------------------------------------------------------ */

/**
 * Import feuille → application. Lecture seule côté Google (aucune écriture dans la
 * feuille) ; c'est le seul point d'entrée de la synchro.
 */
ipcMain.handle('clients:sync-sheets', async () => {
  try {
    const config = await gsheet.loadConfig(userDataDir());
    if (!config) {
      return {
        ok: false,
        error: `Configuration Google Sheets absente : ${gsheet.configPath(userDataDir())}`,
      };
    }
    if (!config.spreadsheetId) {
      return {
        ok: false,
        error: 'Aucune feuille configurée : renseignez "spreadsheetId" dans gsheet-config.json.',
      };
    }

    const { rows } = await gsheet.readRows(config);
    const parsed = sheetSync.parseSheetRows(rows);
    const { report, clients: list } = await clients.syncFromSheet(parsed.clients, {
      ignored: config.ignored,
      renameMap: config.renameMap,
    });

    return {
      ok: true,
      clients: list,
      report: {
        ...report,
        rowsRead: parsed.rowsRead,
        duplicates: parsed.duplicates,
      },
    };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
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

  app.whenReady().then(async () => {
    app.setAppUserModelId('com.editorialstudio.app');
    await ensureGsheetConfig();
    const backupDaily = async () => {
      try {
        const result = await clients.createScheduledBackups();
        if (result.created > 0) {
          console.info(`[backup] ${result.created} calendrier(s) sauvegardé(s) dans ${result.directory}`);
        }
      } catch (error) {
        console.error('[backup] sauvegarde automatique impossible', error);
      }
    };
    void backupDaily();
    const backupTimer = setInterval(backupDaily, 6 * 60 * 60 * 1000);
    backupTimer.unref();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
