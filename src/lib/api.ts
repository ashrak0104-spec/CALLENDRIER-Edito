import type { EditorialPayload, PostItem } from '../types';

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

export interface ClientDataResult {
  ok: boolean;
  data?: unknown;
  reason?: ClientDataFailure;
  file?: string;
  error?: string;
}

export type ResolveClientInput = { mode: 'empty' } | { mode: 'restore'; items: PostItem[] };

export interface AuthStatus {
  authenticated: boolean;
  email: string | null;
  configured: boolean;
  senderEmail: string;
  dev: boolean;
}

export interface AuthCodeResult {
  ok: boolean;
  error?: string;
  devCode?: string;
  retryAfterSeconds?: number;
  ttlMinutes?: number;
}

export interface AuthVerifyResult {
  ok: boolean;
  email?: string;
  error?: string;
}

export interface AuthConfigureResult {
  configured: boolean;
  senderEmail: string;
  senderName: string;
  error?: string;
}

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
  authStatus: () => Promise<AuthStatus>;
  authRequestCode: (email: string) => Promise<AuthCodeResult>;
  authVerify: (email: string, code: string) => Promise<AuthVerifyResult>;
  authLogout: () => Promise<{ ok: boolean }>;
  authConfig: () => Promise<AuthConfigureResult>;
  authConfigure: (config: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    senderEmail: string;
    senderName: string;
  }) => Promise<AuthConfigureResult>;
  clientsList: () => Promise<ClientMeta[]>;
  clientsActive: () => Promise<string | null>;
  clientsSelect: (id: string) => Promise<ClientMeta>;
  clientsCreate: (name: string) => Promise<ClientMeta>;
}

declare global {
  interface Window {
    desktop?: DesktopApi;
  }
}

const LS_KEY = 'editorial-studio:data:v1';
const AUTH_KEY = 'editorial-studio:auth:v1';
const CLIENTS_KEY = 'editorial-studio:clients:v1';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Code du mode navigateur (développement uniquement, jamais utilisé dans Electron). */
let browserCode: { email: string; code: string } | null = null;

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

/**
 * Mode navigateur (`npm run dev` sans preload). Dans Electron, window.desktop
 * est toujours prioritaire et les données vivent dans userData.
 */
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
  authStatus: async () => {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) {
      return { authenticated: false, email: null, configured: true, senderEmail: '', dev: true };
    }
    try {
      const session = JSON.parse(raw) as { email?: unknown };
      return {
        authenticated: typeof session.email === 'string' && Boolean(session.email),
        email: typeof session.email === 'string' ? session.email : null,
        configured: true,
        senderEmail: '',
        dev: true,
      };
    } catch {
      return { authenticated: false, email: null, configured: true, senderEmail: '', dev: true };
    }
  },
  authRequestCode: async (email) => {
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_RE.test(normalized)) return { ok: false, error: 'Adresse email invalide.' };
    const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
    browserCode = { email: normalized, code };
    return { ok: true, devCode: code, ttlMinutes: 10 };
  },
  authVerify: async (email, code) => {
    if (!browserCode || browserCode.email !== email.trim().toLowerCase()) {
      return { ok: false, error: 'Demandez un nouveau code de connexion.' };
    }
    if (browserCode.code !== code) {
      return { ok: false, error: 'Code incorrect.' };
    }
    localStorage.setItem(AUTH_KEY, JSON.stringify({ email: browserCode.email }));
    const signedEmail = browserCode.email;
    browserCode = null;
    return { ok: true, email: signedEmail };
  },
  authLogout: async () => {
    localStorage.removeItem(AUTH_KEY);
    browserCode = null;
    return { ok: true };
  },
  authConfig: async () => ({ configured: true, senderEmail: '', senderName: '' }),
  authConfigure: async (config) => ({
    configured: true,
    senderEmail: config.senderEmail,
    senderName: config.senderName,
  }),
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
};

export const api: DesktopApi =
  typeof window !== 'undefined' && window.desktop ? window.desktop : browserApi;

export const isDesktop =
  typeof window !== 'undefined' && typeof window.desktop !== 'undefined';
