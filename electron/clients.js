'use strict';

const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');

/**
 * Un fichier de données par client, plus un index `clients.json`.
 * L'ancien `editorial-data.json` est migré vers un premier client au démarrage.
 */

const indexPath = () => path.join(app.getPath('userData'), 'clients.json');
const clientsDir = () => path.join(app.getPath('userData'), 'clients');
const dataPathFor = (id) => path.join(clientsDir(), `${id}.json`);
const legacyPath = () => path.join(app.getPath('userData'), 'editorial-data.json');

let indexPromise = null;

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

/** Read that distinguishes "absent" from "illisible". */
async function readStrict(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, file);
}

function newId() {
  return `client_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
}

function cleanName(value) {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 1) throw new Error('Le nom du client est obligatoire.');
  if (name.length > 60) throw new Error('Le nom du client est trop long (60 caractères maximum).');
  return name;
}

async function buildIndex() {
  const existing = await readJson(indexPath());
  if (existing && Array.isArray(existing.clients)) {
    return { version: 1, activeClientId: existing.activeClientId ?? null, clients: existing.clients };
  }

  const legacy = await readJson(legacyPath());
  const index = { version: 1, activeClientId: null, clients: [] };

  if (legacy && Array.isArray(legacy.items)) {
    const id = newId();
    const createdAt =
      typeof legacy.updatedAt === 'string' ? legacy.updatedAt : new Date().toISOString();
    await writeJson(dataPathFor(id), legacy);
    index.clients.push({ id, name: 'Mon calendrier', createdAt });
    index.activeClientId = id;
    // Conserve une copie de l'ancien fichier au lieu de le supprimer.
    try {
      await fs.rename(legacyPath(), `${legacyPath()}.migrated`);
    } catch {
      /* ignore : le client contient déjà les données */
    }
  }

  await writeJson(indexPath(), index);
  return index;
}

function ensureIndex() {
  if (!indexPromise) {
    indexPromise = buildIndex().catch((error) => {
      indexPromise = null;
      throw error;
    });
  }
  return indexPromise;
}

async function saveIndex(index) {
  await writeJson(indexPath(), index);
  indexPromise = Promise.resolve(index);
}

async function metaFor(client) {
  const data = await readJson(dataPathFor(client.id));
  return {
    id: client.id,
    name: client.name,
    createdAt: client.createdAt,
    updatedAt:
      typeof data?.updatedAt === 'string' ? data.updatedAt : client.createdAt ?? new Date(0).toISOString(),
    itemCount: Array.isArray(data?.items) ? data.items.length : 0,
  };
}

async function list() {
  const index = await ensureIndex();
  return Promise.all(index.clients.map((client) => metaFor(client)));
}

async function activeId() {
  const index = await ensureIndex();
  return index.activeClientId ?? null;
}

function activePath() {
  return indexPath();
}

async function currentDataPath() {
  const index = await ensureIndex();
  if (!index.activeClientId) return null;
  return dataPathFor(index.activeClientId);
}

async function select(id) {
  const index = await ensureIndex();
  const client = index.clients.find((entry) => entry.id === id);
  if (!client) throw new Error('Client introuvable.');
  index.activeClientId = client.id;
  await saveIndex(index);
  return metaFor(client);
}

async function create(rawName) {
  const name = cleanName(rawName);
  const index = await ensureIndex();
  const client = {
    id: newId(),
    name,
    createdAt: new Date().toISOString(),
  };
  await writeJson(dataPathFor(client.id), {
    version: 1,
    updatedAt: new Date().toISOString(),
    items: [],
  });
  index.clients.push(client);
  index.activeClientId = client.id;
  await saveIndex(index);
  return metaFor(client);
}

async function loadActiveData() {
  const index = await ensureIndex();
  if (!index.activeClientId) return null;
  const file = dataPathFor(index.activeClientId);
  try {
    return await readStrict(file);
  } catch (error) {
    // Fichier illisible : on le met de côté plutôt que de l'écraser.
    try {
      await fs.rename(file, `${file}.corrupt-${Date.now()}.json`);
    } catch {
      /* ignore */
    }
    console.error('[clients] data:load failed', error);
    return null;
  }
}

async function saveActiveData(payload) {
  const index = await ensureIndex();
  if (!index.activeClientId) throw new Error('Aucun client actif.');
  await writeJson(dataPathFor(index.activeClientId), payload);
  return { path: dataPathFor(index.activeClientId) };
}

module.exports = {
  list,
  activeId,
  activePath,
  currentDataPath,
  select,
  create,
  loadActiveData,
  saveActiveData,
};
