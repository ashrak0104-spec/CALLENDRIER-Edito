'use strict';

/**
 * Import feuille de calcul → application (sens unique, voir docs/sync-google-sheets.md).
 *
 * Module Node pur : aucun accès disque, aucun import `electron`. La lecture de la feuille
 * (`electron/gsheet.js`) et l'écriture de `clients.json` (`electron/clients.js`) restent
 * ailleurs ; ici on ne fait que convertir des lignes et calculer le rattachement.
 */

const NAME_COLUMNS = [
  'client',
  'nom',
  'nom client',
  'nom du client',
  'name',
  'client name',
  'raison sociale',
];
const ID_COLUMNS = ['id', 'identifiant', 'code', 'slug'];
/** L'en-tête n'est cherché que dans les premières lignes (titres ou lignes vides au-dessus). */
const HEADER_SCAN_ROWS = 10;
/** Même limite que `clients.cleanName`. */
const MAX_NAME = 60;

const cellText = (value) => String(value ?? '').trim();

/** Identifiant de dossier stable : accents retirés, tout le reste en tirets. */
function slugify(value) {
  return (
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'client'
  );
}

/** Comparaison de noms : casse, accents et espaces ignorés. */
function normalizeName(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function locateHeader(rows) {
  for (let index = 0; index < Math.min(rows.length, HEADER_SCAN_ROWS); index++) {
    const header = (rows[index] ?? []).map(cellText);
    const lowered = header.map((cell) => cell.toLowerCase());
    const nameColumn = lowered.findIndex((cell) => NAME_COLUMNS.includes(cell));
    if (nameColumn < 0) continue;
    return {
      headerIndex: index,
      header,
      nameColumn,
      idColumn: lowered.findIndex((cell) => ID_COLUMNS.includes(cell)),
    };
  }
  return null;
}

/**
 * Lignes de la feuille → clients candidats.
 *
 * `key` est la clé de feuille (identité stable de la ligne) et `id` l'identifiant local
 * dérivé ; deux lignes qui produisent le même identifiant reçoivent un suffixe `-2`, `-3`
 * et sont signalées dans `duplicates`.
 */
function parseSheetRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const located = locateHeader(list);
  if (!located) return { clients: [], header: [], rowsRead: list.length, duplicates: [] };

  const { headerIndex, header, nameColumn, idColumn } = located;
  const clients = [];
  const duplicates = [];
  const usedKeys = new Set();

  for (let index = headerIndex + 1; index < list.length; index++) {
    const row = list[index] ?? [];
    const name = cellText(row[nameColumn]).slice(0, MAX_NAME);
    if (!name) continue;

    // Cellule `ID` vide : le nom sert de clé (sinon toutes les lignes vides
    // partageraient le slug de repli).
    const rawKey = idColumn >= 0 ? cellText(row[idColumn]) : '';
    const base = slugify(rawKey || name);
    let key = base;
    for (let suffix = 2; usedKeys.has(key); suffix++) key = `${base}-${suffix}`;
    if (key !== base) duplicates.push({ name, key });
    usedKeys.add(key);

    const fields = {};
    for (const [column, label] of header.entries()) {
      if (label && !(label in fields)) fields[label] = cellText(row[column]);
    }

    clients.push({ key, id: `client_${key}`, name, fields });
  }

  return { clients, header, rowsRead: list.length, duplicates };
}

/**
 * Rattachement pur : index `clients.json` + lignes de la feuille → nouvel index
 * (jamais muté en place), clients à créer et rapport d'import.
 *
 * Règles (docs/sync-google-sheets.md §4 et §5) :
 *   1. lien mémorisé (`sheetKey`) → 2. identifiant dérivé → 3. nom normalisé unique
 *   → 4. création. Aucun fichier de données n'est déplacé, renommé ni supprimé.
 */
function planSheetSync(index, rows, options = {}) {
  const ignored = new Set(Array.isArray(options.ignored) ? options.ignored : []);
  const renameMap =
    options.renameMap && typeof options.renameMap === 'object' ? options.renameMap : {};
  const now = typeof options.now === 'string' ? options.now : new Date().toISOString();

  const clients = (Array.isArray(index?.clients) ? index.clients : []).map((entry) => ({
    ...entry,
  }));
  const byKey = new Map();
  const byId = new Map();
  const byName = new Map();
  for (const client of clients) {
    if (typeof client.sheetKey === 'string' && client.sheetKey) byKey.set(client.sheetKey, client);
    byId.set(client.id, client);
    const normalized = normalizeName(String(client.name ?? ''));
    if (!byName.has(normalized)) byName.set(normalized, []);
    byName.get(normalized).push(client);
  }

  // Clés présentes dans cette lecture : une ligne qui les porte « réclame » déjà le client
  // correspondant, qui ne peut donc pas être réutilisé par le nom d'une autre ligne.
  const rowKeys = new Set(
    (Array.isArray(rows) ? rows : []).map((row) => row?.key).filter((key) => typeof key === 'string'),
  );
  const create = [];
  const claimed = new Set();
  const seen = new Set();
  const report = {
    rowsRead: 0,
    created: [],
    updated: [],
    unchanged: 0,
    ambiguous: [],
    duplicates: [],
    missing: [],
    ignored: [],
  };
  let changed = false;

  for (const row of Array.isArray(rows) ? rows : []) {
    const key = typeof row?.key === 'string' ? row.key : '';
    const name = cellText(row?.name).slice(0, MAX_NAME);
    if (!key || !name) continue;

    if (ignored.has(key)) {
      // Supprimé volontairement dans l'application : la ligne n'est pas réimportée.
      seen.add(key);
      report.ignored.push(key);
      continue;
    }

    const derivedId = typeof row.id === 'string' && row.id ? row.id : `client_${key}`;
    let client = byKey.get(key) ?? null;
    if (!client && !claimed.has(derivedId)) client = byId.get(derivedId) ?? null;
    if (!client) {
      // Réutilisable par le nom : client libre, dont la clé n'est pas réclamée par une autre
      // ligne de cette lecture (un client encore lié à une clé disparue de la feuille reste
      // donc récupérable — colonne `ID` retirée, par exemple).
      const candidates = (byName.get(normalizeName(name)) ?? []).filter(
        (entry) =>
          !claimed.has(entry.id) &&
          !(typeof entry.sheetKey === 'string' && rowKeys.has(entry.sheetKey)),
      );
      if (candidates.length > 1) {
        report.ambiguous.push({ name, candidates: candidates.length });
        continue;
      }
      if (candidates.length === 1) client = candidates[0];
    }

    if (client && claimed.has(client.id)) {
      // Deux lignes de la feuille visent le même client : aucune fusion automatique.
      report.ambiguous.push({ name, candidates: 1 });
      continue;
    }

    const displayName = cellText(renameMap[name]) || name;
    const fields =
      row.fields && typeof row.fields === 'object' && !Array.isArray(row.fields)
        ? row.fields
        : undefined;
    const fieldsChanged =
      fields !== undefined && JSON.stringify(client?.fields ?? {}) !== JSON.stringify(fields);

    if (client) {
      claimed.add(client.id);
      seen.add(key);
      const renamed = client.name !== displayName;
      const relinked = client.sheetKey !== key;
      if (renamed || relinked || fieldsChanged || client.sheetMissing === true) {
        client.name = displayName;
        client.sheetKey = key;
        delete client.sheetMissing;
        if (fields !== undefined) client.fields = fields;
        report.updated.push(displayName);
        changed = true;
      } else {
        report.unchanged++;
      }
      continue;
    }

    const taken = (candidate) => byId.has(candidate) || create.some((entry) => entry.id === candidate);
    let id = derivedId;
    for (let suffix = 2; taken(id); suffix++) id = `${derivedId}-${suffix}`;

    const created = { id, name: displayName, createdAt: now, sheetKey: key };
    if (fields !== undefined) created.fields = fields;
    clients.push(created);
    byId.set(id, created);
    claimed.add(id);
    seen.add(key);
    create.push(created);
    report.created.push(displayName);
    changed = true;
  }

  for (const client of clients) {
    if (!client.sheetKey) continue;
    if (seen.has(client.sheetKey)) {
      if (client.sheetMissing === true) {
        delete client.sheetMissing;
        changed = true;
      }
      continue;
    }
    // Jamais supprimé : le client reste utilisable, seulement marqué « absente de la feuille ».
    if (client.sheetMissing !== true) {
      client.sheetMissing = true;
      changed = true;
    }
    report.missing.push(client.name);
  }

  return { index: { ...index, clients }, create, report, changed };
}

module.exports = {
  MAX_NAME,
  slugify,
  normalizeName,
  parseSheetRows,
  planSheetSync,
};
