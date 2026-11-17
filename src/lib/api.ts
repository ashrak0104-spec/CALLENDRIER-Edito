import type { EditorialPayload } from '../types';

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
  loadData: () => Promise<unknown>;
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
    apiKey: string;
    senderEmail: string;
    senderName: string;
  }) => Promise<AuthConfigureResult>;
}

declare global {
  interface Window {
    desktop?: DesktopApi;
  }
}

const LS_KEY = 'editorial-studio:data:v1';
const AUTH_KEY = 'editorial-studio:auth:v1';
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

/**
 * Browser fallback used by `npm run dev` in a normal browser tab (no preload).
 * Inside Electron, window.desktop always wins and data lives in userData.
 */
const browserApi: DesktopApi = {
  loadData: async () => {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  saveData: async (payload) => {
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
    return { ok: true, path: 'localStorage (mode navigateur)' };
  },
  getDataPath: async () => 'localStorage · editorial-studio:data:v1 (mode navigateur)',
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
  pickAssets: async () => [],
  openTarget: async (target) => {
    window.open(target, '_blank', 'noopener,noreferrer');
  },
  appVersion: async () => '1.0.0 (navigateur)',
};

export const api: DesktopApi =
  typeof window !== 'undefined' && window.desktop ? window.desktop : browserApi;

export const isDesktop =
  typeof window !== 'undefined' && typeof window.desktop !== 'undefined';
