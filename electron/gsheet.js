'use strict';

/**
 * Accès Google Sheets.
 *
 * Module Node pur (aucun import `electron`) pour rester testable hors application.
 *
 * Le fichier `userData/gsheet-config.json` décrit la feuille et le mode d'authentification :
 *
 *   {
 *     "spreadsheetId": "1GQ3...",
 *     "spreadsheetUrl": "https://docs.google.com/spreadsheets/d/1GQ3.../edit",
 *     "range": "Sheet1!A1:Z1000",
 *     "auth": {
 *       "mode": "serviceAccount",                 // "serviceAccount" | "oauth" | "public"
 *       "credentialsPath": "C:\\cles\\compte-service.json",
 *       "credentials": { … },                     // facultatif : clé JSON en ligne
 *       "clientId": "…apps.googleusercontent.com",// mode oauth
 *       "clientSecret": "…",
 *       "refreshToken": "…"
 *     }
 *   }
 *
 * Modes :
 *  - serviceAccount : clé JSON d'un compte de service, la feuille doit être partagée
 *    avec son adresse `client_email` (lecteur suffit).
 *  - oauth : identifiants d'un client OAuth « application de bureau » + refresh token
 *    obtenu une fois pour le compte Google qui possède la feuille.
 *  - public : feuille partagée par lien (« Tout utilisateur disposant du lien »),
 *    lue via l'export CSV public, sans identifiants.
 */

const path = require('node:path');
const fs = require('node:fs/promises');

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const CONFIG_FILE = 'gsheet-config.json';

const DEFAULT_CONFIG = {
  spreadsheetId: '',
  spreadsheetUrl: '',
  range: 'Sheet1!A1:Z1000',
  auth: { mode: 'public' },
};

const configPath = (userDataDir) => path.join(userDataDir, CONFIG_FILE);

/** Fusionne l'ancien format (`credentialsPath` à la racine) et applique les valeurs par défaut. */
function normalizeConfig(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const auth = { ...(raw.auth && typeof raw.auth === 'object' ? raw.auth : {}) };
  if (!auth.mode) {
    auth.mode = auth.refreshToken ? 'oauth' : auth.credentialsPath || auth.credentials ? 'serviceAccount' : 'public';
  }
  if (!auth.credentialsPath && typeof raw.credentialsPath === 'string') {
    auth.credentialsPath = raw.credentialsPath;
  }
  const spreadsheetId =
    typeof raw.spreadsheetId === 'string' && raw.spreadsheetId.trim()
      ? raw.spreadsheetId.trim()
      : readIdFromUrl(raw.spreadsheetUrl);
  return {
    spreadsheetId,
    spreadsheetUrl: typeof raw.spreadsheetUrl === 'string' ? raw.spreadsheetUrl : '',
    range: typeof raw.range === 'string' && raw.range ? raw.range : DEFAULT_CONFIG.range,
    auth,
    // Clés de feuille volontairement non importées (clients supprimés dans l'application).
    ignored: Array.isArray(raw.ignored)
      ? raw.ignored.filter((key) => typeof key === 'string' && key.trim()).map((key) => key.trim())
      : [],
    // Noms affichés différents de la feuille : { "nom dans la feuille": "nom affiché" }.
    renameMap:
      raw.renameMap && typeof raw.renameMap === 'object' && !Array.isArray(raw.renameMap)
        ? Object.fromEntries(
            Object.entries(raw.renameMap).filter(
              ([from, to]) => typeof from === 'string' && typeof to === 'string' && to.trim(),
            ),
          )
        : {},
  };
}

function readIdFromUrl(url) {
  if (typeof url !== 'string') return '';
  const match = url.match(/\/d\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : '';
}

async function loadConfig(userDataDir) {
  const file = configPath(userDataDir);
  let contents;
  try {
    contents = await fs.readFile(file, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw new Error(
      `Lecture de la configuration Google Sheets impossible (${file}) : ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new Error(`Configuration Google Sheets illisible (${file}) : JSON invalide.`);
  }

  const config = normalizeConfig(parsed);
  if (!config) throw new Error(`Configuration Google Sheets invalide (${file}).`);
  return config;
}

/** Écrit la configuration de façon atomique (jamais de fichier tronqué). */
async function saveConfig(userDataDir, config) {
  const target = configPath(userDataDir);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(config, null, 2), 'utf8');
  await fs.rename(tmp, target);
  return target;
}

/** Crée la configuration par défaut si le fichier n'existe pas encore. */
async function ensureConfig(userDataDir, overrides = {}) {
  const existing = await loadConfig(userDataDir);
  if (existing) return existing;
  const config = normalizeConfig({ ...DEFAULT_CONFIG, ...overrides });
  await saveConfig(userDataDir, config);
  return config;
}

/**
 * Mémorise qu'une clé de feuille ne doit plus être importée (client supprimé dans
 * l'application). Sans configuration existante, rien n'est écrit.
 */
async function addIgnored(userDataDir, key) {
  const trimmed = typeof key === 'string' ? key.trim() : '';
  if (!trimmed) return null;
  const config = await loadConfig(userDataDir);
  if (!config) return null;
  if (config.ignored.includes(trimmed)) return config;
  config.ignored = [...config.ignored, trimmed];
  await saveConfig(userDataDir, config);
  return config;
}

async function readKeyFile(credentialsPath) {
  const resolved = path.resolve(credentialsPath);
  let raw;
  try {
    raw = await fs.readFile(resolved, 'utf8');
  } catch (error) {
    throw new Error(
      `Clé du compte de service introuvable (${resolved}) : ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Clé du compte de service illisible (${resolved}) : JSON invalide.`);
  }
}

async function serviceAccountToken(auth) {
  const credentials = auth.credentials ?? (auth.credentialsPath ? await readKeyFile(auth.credentialsPath) : null);
  if (!credentials?.client_email || !credentials?.private_key) {
    throw new Error(
      'Clé de compte de service incomplète : "client_email" et "private_key" sont requis.',
    );
  }
  const { JWT } = require('google-auth-library');
  const client = new JWT({ email: credentials.client_email, key: credentials.private_key, scopes: [SHEETS_SCOPE] });
  const token = await client.getAccessToken();
  if (!token?.token) throw new Error('Google n’a pas renvoyé de jeton pour le compte de service.');
  return { token: token.token, account: credentials.client_email };
}

async function oauthToken(auth) {
  if (!auth.clientId || !auth.clientSecret || !auth.refreshToken) {
    throw new Error(
      'Authentification OAuth incomplète : "clientId", "clientSecret" et "refreshToken" sont requis.',
    );
  }
  const { OAuth2Client } = require('google-auth-library');
  const client = new OAuth2Client({ clientId: auth.clientId, clientSecret: auth.clientSecret });
  client.setCredentials({ refresh_token: auth.refreshToken });
  const token = await client.getAccessToken();
  if (!token?.token) throw new Error('Google n’a pas renvoyé de jeton OAuth (refresh token expiré ?).');
  return { token: token.token, account: 'compte OAuth' };
}

async function explainHttpError(response, account) {
  let body = '';
  try {
    body = await response.text();
  } catch {
    /* corps illisible : le statut suffit */
  }
  let detail = '';
  try {
    detail = JSON.parse(body)?.error?.message ?? '';
  } catch {
    detail = body.slice(0, 300);
  }
  if (response.status === 401) {
    return new Error(`Google a refusé les identifiants (401). ${detail}`.trim());
  }
  if (response.status === 403) {
    return new Error(
      `Accès refusé à la feuille (403) pour ${account}. Partagez le document avec ce compte en lecture. ${detail}`.trim(),
    );
  }
  if (response.status === 404) {
    return new Error(`Feuille ou plage introuvable (404). Vérifiez "spreadsheetId" et "range". ${detail}`.trim());
  }
  return new Error(`Lecture Google Sheets impossible (${response.status}). ${detail}`.trim());
}

async function readViaApi(config, spreadsheetId, range) {
  const mode = config.auth?.mode ?? 'public';
  const { token, account } = mode === 'oauth' ? await oauthToken(config.auth) : await serviceAccountToken(config.auth);
  const url = `${SHEETS_API}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(
    range,
  )}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw await explainHttpError(response, account);
  const body = await response.json();
  return { rows: Array.isArray(body.values) ? body.values : [], source: mode };
}

/** Export CSV public d'un onglet (feuille partagée par lien). */
async function readViaPublicCsv(spreadsheetId, range) {
  const sheetName = range.includes('!') ? range.slice(0, range.lastIndexOf('!')).replace(/^'|'$/g, '') : '';
  const query = sheetName ? `?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}` : '?tqx=out:csv';
  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/gviz/tq${query}`;
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(
      `La feuille n’est pas accessible publiquement (${response.status}). Configurez un compte de service ou un accès OAuth.`,
    );
  }
  const text = await response.text();
  if (/^\s*</.test(text)) {
    throw new Error(
      'La feuille n’est pas partagée publiquement (réponse HTML au lieu du CSV). Configurez un compte de service ou un accès OAuth.',
    );
  }
  return { rows: parseCsv(text), source: 'public' };
}

/** Analyseur CSV (guillemets, virgules et retours à la ligne échappés). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((value) => value !== ''));
}

/** Rangée de valeurs lues dans une feuille, quelle que soit la méthode d'authentification. */
async function readRows(config, spreadsheetId, range) {
  const sheetId = spreadsheetId || config?.spreadsheetId;
  if (!sheetId) throw new Error('Identifiant de feuille manquant.');
  const sheetRange = range || config?.range || DEFAULT_CONFIG.range;
  const mode = config?.auth?.mode ?? 'public';

  if (mode === 'public') return readViaPublicCsv(sheetId, sheetRange);
  return readViaApi(config, sheetId, sheetRange);
}

module.exports = {
  CONFIG_FILE,
  DEFAULT_CONFIG,
  normalizeConfig,
  configPath,
  loadConfig,
  saveConfig,
  ensureConfig,
  addIgnored,
  readRows,
  parseCsv,
};
