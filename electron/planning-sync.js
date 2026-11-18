'use strict';

/**
 * Planning éditorial (lignes d'onglets Google Sheets) → contenus de l'application.
 *
 * Module Node pur : aucun accès disque, aucun import `electron`. La lecture de la
 * feuille (`electron/gsheet.js`) et l'écriture du calendrier (`electron/clients.js`)
 * restent ailleurs ; ici on ne fait que traduire des lignes.
 *
 * Convention : un onglet = une plateforme, et le sens est unique (feuille → app,
 * voir docs/sync-google-sheets.md). Rien n'est jamais écrit dans la feuille.
 */

const crypto = require('node:crypto');

/** Onglets de planning lus par défaut, dans cet ordre. */
const CALENDAR_TABS = ['Facebook', 'Instagram'];

/** En-têtes acceptés → champ du modèle. */
const COLUMNS = {
  ref: ['ref', 'n°', 'no', 'numéro'],
  date: ['date'],
  time: ['heure', 'horaire'],
  platform: ['plateforme', 'platform'],
  title: ['sujet', 'titre', 'title'],
  content: ['contenu éditorial', 'contenu', 'copy'],
  format: ['format'],
  product: ['produit / univers', 'produit', 'univers'],
  goal: ['objectif'],
  status: ['statut', 'status'],
  assignee: ['responsable', 'assignee'],
};

const PLATFORMS = [
  'LinkedIn',
  'Facebook',
  'Instagram',
  'TikTok',
  'YouTube',
  'Blog/SEO',
  'Newsletter',
  'X/Twitter',
];

/** Formats : le premier motif qui correspond gagne, par ordre de spécificité. */
const FORMAT_RULES = [
  [/carrousel/i, 'Carrousel'],
  [/reel|vid[ée]o/i, 'Vidéo courte/Reel'],
  [/infographie/i, 'Infographie'],
  [/podcast/i, 'Podcast'],
  [/article|blog/i, 'Article'],
  [/photo|visuel|post|texte/i, 'Post Texte'],
];

const STATUS_RULES = [
  [/publi[ée]/i, 'Publié'],
  [/programm|planifi/i, 'Programmé'],
  [/valid[ée]|pr[êe]t/i, 'Validé / Prêt'],
  [/r[ée]vision|relecture/i, 'En révision'],
  [/r[ée]daction|cr[ée]ation|en cours/i, 'Rédaction / Création'],
  [/pr[ée]par|backlog|id[ée]e/i, 'Idée / Backlog'],
];

/** Le pilier n'existe pas dans le planning : il est dérivé de la colonne « Objectif ». */
const PILLAR_RULES = [
  [/visibilit|identit|notori/i, 'Autorité'],
  [/vente|commande|offre|demande|conversion/i, 'Conversion'],
  [/coulisse|storytelling|derri[èe]re/i, 'Coulisses/Storytelling'],
  [/int[ée]r[êe]t produit|produit|r[ée]f[ée]rence|d[ée]couverte|d[ée]couvrir|diversit/i, 'Éducation'],
  [/int[ée]r[êe]t|nouveaut|actualit/i, 'Actualité'],
];

/** Normalise les en-têtes d'une ligne pour un accès insensible à la casse. */
function headerKeys(values) {
  return values.map((label) => String(label ?? '').trim().toLowerCase());
}

/** Ligne brute + en-têtes → objet indexé par en-tête normalisé. */
function toRecord(header, values) {
  const record = {};
  headerKeys(header).forEach((label, index) => {
    if (!label) return;
    if (record[label] === undefined) record[label] = values[index] ?? '';
  });
  return record;
}

function pick(row, field) {
  const key = COLUMNS[field].find((label) => row[label] !== undefined);
  return key ? String(row[key] ?? '').trim() : '';
}

function match(rules, value) {
  const rule = rules.find(([pattern]) => pattern.test(value));
  return rule ? rule[1] : null;
}

function asPlatform(raw) {
  const found = PLATFORMS.find((value) => value.toLowerCase() === raw.toLowerCase());
  return found ?? null;
}

function validDate(stamp) {
  const date = new Date(`${stamp}T00:00:00`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === Number(stamp.slice(0, 4)) &&
    date.getMonth() + 1 === Number(stamp.slice(5, 7)) &&
    date.getDate() === Number(stamp.slice(8, 10))
  );
}

/** Accepte `2026-11-19` comme `19/11/2026` et renvoie toujours `AAAA-MM-JJ`. */
function parseDate(value) {
  const text = String(value ?? '').trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (iso) {
    const stamp = `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
    return validDate(stamp) ? stamp : null;
  }
  const french = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(text);
  if (french) {
    const stamp = `${french[3]}-${french[2].padStart(2, '0')}-${french[1].padStart(2, '0')}`;
    return validDate(stamp) ? stamp : null;
  }
  return null;
}

/** Accepte `18h30`, `18:30`, `18h` ; renvoie `HH:MM`. */
function parseTime(value) {
  const text = String(value ?? '').trim();
  const found = /^(\d{1,2})\s*[h:]\s*(\d{0,2})/.exec(text) || /^(\d{1,2})$/.exec(text);
  if (!found) return null;
  const hours = Number(found[1]);
  const minutes = Number(found[2] || 0);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Une ligne de planning → `{ item }` ou `{ error }` (+ `warnings`).
 *
 * `options.platform` prime sur la colonne « Plateforme » (un onglet = une plateforme).
 * `scheduledDate` est une date ISO sans décalage : l'heure de la feuille est une heure
 * locale, elle doit s'afficher telle quelle dans le calendrier.
 */
function toItem(record, options = {}) {
  const now = options.now ?? new Date().toISOString();
  const ref = pick(record, 'ref');

  const title = pick(record, 'title');
  if (!title) return { error: `${ref || '(sans réf.)'} : pas de sujet` };

  const platformRaw = options.platform ?? pick(record, 'platform');
  const platform = asPlatform(platformRaw);
  if (!platform) return { error: `${ref} : plateforme « ${platformRaw} » inconnue` };

  const dateRaw = pick(record, 'date');
  const date = parseDate(dateRaw);
  if (!date) return { error: `${ref} : date « ${dateRaw} » illisible` };

  const warnings = [];
  const timeRaw = pick(record, 'time');
  const time = parseTime(timeRaw);
  if (!time) warnings.push(`heure illisible « ${timeRaw} », 09:00 appliqué`);

  const formatRaw = pick(record, 'format');
  const format = match(FORMAT_RULES, formatRaw);
  if (!format) return { error: `${ref} : format non reconnu « ${formatRaw} »` };

  const statusRaw = pick(record, 'status');
  const status = match(STATUS_RULES, statusRaw);
  if (!status) return { error: `${ref} : statut non reconnu « ${statusRaw} »` };

  const goal = pick(record, 'goal');
  const pillar = match(PILLAR_RULES, goal);
  if (!pillar) warnings.push(`objectif sans pilier déduit : « ${goal} »`);

  const product = pick(record, 'product');

  return {
    item: {
      id: crypto.randomUUID(),
      title,
      content: pick(record, 'content'),
      platform,
      format,
      status,
      pillar: pillar ?? 'Éducation',
      scheduledDate: `${date}T${time ?? '09:00'}:00`,
      assignee: pick(record, 'assignee') || options.assignee || '',
      tags: product ? [product] : [],
      checklist: [],
      assets: [],
      createdAt: now,
      updatedAt: now,
    },
    warnings,
  };
}

/** Ligne d'en-tête = première ligne contenant à la fois « date » et « sujet ». */
function findHeaderRow(rows) {
  const list = Array.isArray(rows) ? rows : [];
  for (let index = 0; index < Math.min(list.length, 15); index++) {
    const lowered = (list[index] ?? []).map((cell) => String(cell ?? '').trim().toLowerCase());
    if (lowered.includes('date') && (lowered.includes('sujet') || lowered.includes('titre'))) {
      return index;
    }
  }
  return -1;
}

/** Lignes d'un onglet → contenus (+ lignes ignorées expliquées). */
function mapTab(tab, rows, options = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const headerIndex = findHeaderRow(list);
  if (headerIndex < 0) {
    return {
      items: [],
      problems: [`${tab} : pas d'en-tête « Date » + « Sujet » (onglet ignoré)`],
      rowsRead: list.length,
      records: 0,
    };
  }

  const header = list[headerIndex];
  // Un onglet nommé d'après une plateforme impose celle-ci ; sinon la colonne décide.
  const platform = asPlatform(tab) ? tab : undefined;
  const items = [];
  const problems = [];
  let records = 0;

  for (const values of list.slice(headerIndex + 1)) {
    const record = toRecord(header, values);
    if (String(record.date ?? '').trim() === '') {
      const filled = values.some((cell) => String(cell ?? '').trim() !== '');
      if (filled) problems.push(`${tab} : ligne sans date (${String(values[0] ?? '').slice(0, 40)})`);
      continue;
    }
    records++;
    const result = toItem(record, { ...options, platform });
    if (result.error) {
      problems.push(`${tab} : ${result.error}`);
      continue;
    }
    for (const warning of result.warnings ?? []) problems.push(`${tab} : ${warning}`);
    items.push(result.item);
  }

  return { items, problems, rowsRead: list.length, records };
}

/** Plusieurs onglets → calendrier trié par date. */
function mapTabs(tabs, options = {}) {
  const items = [];
  const problems = [];
  for (const tab of tabs) {
    const mapped = mapTab(tab.title, tab.rows, options);
    items.push(...mapped.items);
    problems.push(...mapped.problems);
  }
  items.sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
  const days = new Set(items.map((item) => item.scheduledDate?.slice(0, 10))).size;
  return { items, problems, days };
}

module.exports = {
  CALENDAR_TABS,
  COLUMNS,
  PLATFORMS,
  FORMAT_RULES,
  STATUS_RULES,
  PILLAR_RULES,
  headerKeys,
  toRecord,
  pick,
  match,
  asPlatform,
  parseDate,
  parseTime,
  findHeaderRow,
  toItem,
  mapTab,
  mapTabs,
};
