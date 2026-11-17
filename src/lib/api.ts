import type { EditorialPayload, PostItem } from '../types';
import { gsheetReadRows } from './gsheet';

export interface BackupResult {
  canceled: boolean;
  filePath?: string;
}

export interface ImportResult {
  canceled: boolean;
  data?: unknown;
  filePath?: string;
  error?: string;
}

export interface SaveResult {
  ok: boolean;
  path: string;
}

export interface ClientMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
}

export type ClientDataFailure = 'missing' | 'unreadable';

export type ResolveClientInput = { mode: 'empty' } | { mode: 'restore'; items: PostItem[] };

export interface DesktopApi {
  loadClientData: () => Promise<ClientDataResult>;
  resolveClient: (input: ResolveClientInput) => Promise<ClientDataResult>;
  saveData: (payload: EditorialPayload) => Promise<SaveResult>;
  getDataPath: () => Promise<string>;
  revealDataFile: () => Promise<void>;
  exportBackup: (payload: EditorialPayload) => Promise<BackupResult>;
  importBackup: () => Promise<ImportResult>;
  exportCsv: (csv: string, suggestedName: string) => Promise<BackupResult>;
  pickAssets: () => Promise<string[]>;
  openTarget: (target: string) => Promise<void>;
  appVersion: () => Promise<string>;
  gsheetReadRows: (spreadsheetId: string, range: string) => Promise<GsheetReadResult>;
  clientsList: () => Promise<ClientMeta[]>;
  clientsActive: () => Promise<string | null>;
  clientsSelect: (id: string) => Promise<ClientMeta>;
  clientsCreate: (name: string) => Promise<ClientMeta>;
  clientsRename: (id: string, name: string) => Promise<ClientMutationResult>;
  clientsDelete: (id: string) => Promise<{ ok: boolean; error?: string }>;
}

export interface ClientDataResult {
  ok: boolean;
  data?: unknown;
  reason?: ClientDataFailure;
  file?: string;
  error?: string;
}

export interface ClientMutationResult {
  ok: boolean;
  client?: ClientMeta;
  error?: string;
}

export interface GsheetReadResult {
  rows: unknown[][];
}

declare global {
  interface Window {
    desktop?: DesktopApi;
  }
}

const LS_KEY = 'editorial-studio:data:v1';
const CLIENTS_KEY = 'editorial-studio:clients:v1';

function download(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function pickJsonFile(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(await file.text()));
      } catch (error) {
        reject(error);
      }
    };
    input.click();
  });
}

/* ------------------------------------------------------------------ */
/* Mode navigateur : clients locaux dans localStorage                   */
/* ------------------------------------------------------------------ */

interface BrowserClient {
  id: string;
  name: string;
  createdAt: string;
}

interface BrowserIndex {
  activeClientId: string | null;
  clients: BrowserClient[];
}

const clientDataKey = (id: string) => `editorial-studio:data:v1:${id}`;

function writeBrowserIndex(index: BrowserIndex): void {
  localStorage.setItem(CLIENTS_KEY, JSON.stringify(index));
}

function readBrowserIndex(): BrowserIndex {
  const raw = localStorage.getItem(CLIENTS_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as BrowserIndex;
      if (parsed && Array.isArray(parsed.clients)) return parsed;
    } catch {
      /* réindexe plus bas */
    }
  }

  const index: BrowserIndex = { activeClientId: null, clients: [] };
  const legacy = localStorage.getItem(LS_KEY);
  if (legacy) {
    const client: BrowserClient = {
      id: `client_${Date.now().toString(36)}_legacy`,
      name: 'Mon calendrier',
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem(clientDataKey(client.id), legacy);
    localStorage.removeItem(LS_KEY);
    index.clients.push(client);
    index.activeClientId = client.id;
  }
  writeBrowserIndex(index);
  return index;
}

function browserMeta(client: BrowserClient): ClientMeta {
  let itemCount = 0;
  let updatedAt = client.createdAt;
  const raw = localStorage.getItem(clientDataKey(client.id));
  if (raw) {
    try {
      const payload = JSON.parse(raw) as { items?: unknown; updatedAt?: unknown };
      if (Array.isArray(payload.items)) itemCount = payload.items.length;
      if (typeof payload.updatedAt === 'string') updatedAt = payload.updatedAt;
    } catch {
      /* fichier illisible : compte zéro */
    }
  }
  return { ...client, updatedAt, itemCount };
}

const browserApi: DesktopApi = {
  loadClientData: async () => {
    const index = readBrowserIndex();
    if (!index.activeClientId) return { ok: false, reason: 'missing', file: '' };
    const file = clientDataKey(index.activeClientId);
    const raw = localStorage.getItem(file);
    if (!raw) return { ok: false, reason: 'missing', file };
    try {
      const data = JSON.parse(raw) as { items?: unknown };
      if (!data || !Array.isArray(data.items)) {
        return { ok: false, reason: 'unreadable', file };
      }
      return { ok: true, data, file };
    } catch {
      return { ok: false, reason: 'unreadable', file };
    }
  },
  resolveClient: async (input) => {
    const index = readBrowserIndex();
    if (!index.activeClientId) return { ok: false, reason: 'missing', file: '' };
    const items = input.mode === 'empty' ? [] : input.items;
    const payload = { version: 1, updatedAt: new Date().toISOString(), items };
    const file = clientDataKey(index.activeClientId);
    localStorage.setItem(file, JSON.stringify(payload));
    return { ok: true, data: payload, file };
  },
  saveData: async (payload) => {
    const index = readBrowserIndex();
    if (!index.activeClientId) throw new Error('Aucun client actif.');
    localStorage.setItem(clientDataKey(index.activeClientId), JSON.stringify(payload));
    return { ok: true, path: `localStorage · ${clientDataKey(index.activeClientId)}` };
  },
  getDataPath: async () => {
    const index = readBrowserIndex();
    return index.activeClientId
      ? `localStorage · ${clientDataKey(index.activeClientId)}`
      : 'localStorage (aucun client)';
  },
  revealDataFile: async () => undefined,
  exportBackup: async (payload) => {
    download(
      `editorial-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2),
      'application/json',
    );
    return { canceled: false };
  },
  importBackup: async () => {
    const data = await pickJsonFile();
    return { canceled: data === null, data: data ?? undefined };
  },
  exportCsv: async (csv, suggestedName) => {
    download(suggestedName, csv, 'text/csv;charset=utf-8');
    return { canceled: false };
  },
  pickAssets: async () => [],
  openTarget: async (target) => {
    window.open(target, '_blank', 'noopener,noreferrer');
  },
  appVersion: async () => '1.0.0 (navigateur)',
  gsheetReadRows,
  clientsList: async () => readBrowserIndex().clients.map(browserMeta),
  clientsActive: async () => readBrowserIndex().activeClientId,
  clientsSelect: async (id) => {
    const index = readBrowserIndex();
    const client = index.clients.find((entry) => entry.id === id);
    if (!client) throw new Error('Client introuvable.');
    index.activeClientId = client.id;
    writeBrowserIndex(index);
    return browserMeta(client);
  },
  clientsCreate: async (name) => {
    const cleaned = name.trim().replace(/\s+/g, ' ');
    if (!cleaned) throw new Error('Le nom du client est obligatoire.');
    const index = readBrowserIndex();
    const client: BrowserClient = {
      id: `client_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`,
      name: cleaned.slice(0, 60),
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem(
      clientDataKey(client.id),
      JSON.stringify({ version: 1, updatedAt: client.createdAt, items: [] }),
    );
    index.clients.push(client);
    index.activeClientId = client.id;
    writeBrowserIndex(index);
    return browserMeta(client);
  },
  clientsRename: async (id, name) => {
    const cleaned = name.trim().replace(/\s+/g, ' ');
    if (!cleaned) return { ok: false, error: 'Le nom du client est obligatoire.' };
    const index = readBrowserIndex();
    const client = index.clients.find((entry) => entry.id === id);
    if (!client) return { ok: false, error: 'Client introuvable.' };
    client.name = cleaned.slice(0, 60);
    writeBrowserIndex(index);
    return { ok: true, client: browserMeta(client) };
  },
  clientsDelete: async (id) => {
    const index = readBrowserIndex();
    if (!index.clients.some((entry) => entry.id === id)) {
      return { ok: false, error: 'Client introuvable.' };
    }
    localStorage.removeItem(clientDataKey(id));
    index.clients = index.clients.filter((entry) => entry.id !== id);
    if (index.activeClientId === id) index.activeClientId = null;
    writeBrowserIndex(index);
    return { ok: true };
  },
};

export const api: DesktopApi =
  typeof window !== 'undefined' && window.desktop ? window.desktop : browserApi;

export const isDesktop =
  typeof window !== 'undefined' && typeof window.desktop !== 'undefined';
