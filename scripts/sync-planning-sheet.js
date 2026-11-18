'use strict';

/**
 * Synchronise le calendrier d'un client avec les onglets de planning de sa feuille
 * Google Sheets (lecture seule côté Google), comme le fait le bouton « Lien Google
 * Sheets » du picker de clients :
 *
 *   node scripts/sync-planning-sheet.js [options]
 *
 *   --client <id|nom>     client cible (par défaut : le client actif de clients.json)
 *   --sheet <id|url>      feuille source (par défaut : celle liée au client)
 *   --tabs <a,b>          onglets de planning (par défaut : Facebook,Instagram)
 *   --assignee <nom>      responsable appliqué (par défaut : Studio éditorial)
 *   --user-data <dir>     dossier de données de l'app (défaut : %APPDATA%/Editorial Studio)
 *   --dry-run             affiche le résultat sans écrire dans le calendrier
 *
 * Le fichier du client est sauvegardé avant remplacement, et rien n'est jamais écrit
 * dans la feuille.
 */

const path = require('node:path');
const fs = require('node:fs/promises');
const gsheet = require('../electron/gsheet');
const planningSync = require('../electron/planning-sync');

function parseArgs(argv) {
  const options = { tabs: planningSync.CALENDAR_TABS, dryRun: false, assignee: 'Studio éditorial' };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    const next = () => argv[++index];
    if (arg === '--client') options.client = next();
    else if (arg === '--tabs')
      options.tabs = String(next() || '')
        .split(',')
        .map((tab) => tab.trim())
        .filter(Boolean);
    else if (arg === '--sheet') options.sheet = next();
    else if (arg === '--assignee') options.assignee = next();
    else if (arg === '--user-data') options.userData = next();
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Option inconnue : ${arg}`);
  }
  return options;
}

const defaultUserData = () =>
  process.env.APPDATA
    ? path.join(process.env.APPDATA, 'Editorial Studio')
    : path.join(process.env.HOME ?? process.cwd(), '.editorial-studio');

function normalizeName(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));

/** Accepte un identifiant de feuille ou une URL complète. */
function sheetIdOf(value) {
  const found = /\/d\/([A-Za-z0-9_-]{20,})/.exec(String(value ?? ''));
  const id = found ? found[1] : String(value ?? '').trim();
  return /^[A-Za-z0-9_-]{20,}$/.test(id) ? id : '';
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(
      'Usage : node scripts/sync-planning-sheet.js [--client <id|nom>] [--sheet <id|url>] [--tabs a,b] [--assignee <nom>] [--user-data <dir>] [--dry-run]',
    );
    return;
  }

  const userData = options.userData ? path.resolve(options.userData) : defaultUserData();
  const index = await readJson(path.join(userData, 'clients.json'));

  const wanted = options.client;
  const client = wanted
    ? index.clients.find((entry) => entry.id === wanted) ??
      index.clients.find((entry) => normalizeName(entry.name) === normalizeName(wanted))
    : index.clients.find((entry) => entry.id === index.activeClientId);

  if (!client) {
    throw new Error(
      wanted
        ? `Client « ${wanted} » introuvable. Clients : ${
            index.clients.map((entry) => `${entry.name} (${entry.id})`).join(', ') || 'aucun'
          }.`
        : 'Aucun client actif : passez --client <id|nom>.',
    );
  }

  const stored = await gsheet.loadConfig(userData);
  const spreadsheetId = sheetIdOf(options.sheet) || sheetIdOf(client.sheetId) || stored?.spreadsheetId || '';
  if (!spreadsheetId) {
    throw new Error('Aucune feuille source : liez une feuille au client ou passez --sheet.');
  }

  const config = { ...(stored ?? {}), spreadsheetId };
  console.log(`Feuille : ${spreadsheetId}`);
  console.log(`Client  : ${client.name} (${client.id})`);

  const tabs = [];
  const problems = [];
  for (const tab of options.tabs) {
    try {
      const { rows, source } = await gsheet.readRows(config, spreadsheetId, `${tab}!A1:Z300`);
      tabs.push({ title: tab, rows });
      console.log(`Onglet ${tab} (${source}) : ${rows.length} lignes`);
    } catch (error) {
      problems.push(`${tab} : ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (tabs.length === 0) throw new Error(problems.join(' · ') || 'Feuille illisible.');

  const mapped = planningSync.mapTabs(tabs, {
    assignee: options.assignee,
    now: new Date().toISOString(),
  });
  const warnings = [...problems, ...mapped.problems];

  const tally = (field) =>
    mapped.items.reduce((counts, item) => {
      counts[item[field]] = (counts[item[field]] ?? 0) + 1;
      return counts;
    }, {});

  console.log(`\n${mapped.items.length} contenu(s) prêt(s) sur ${mapped.days} jour(s) :`);
  for (const item of mapped.items) {
    console.log(
      `- ${item.scheduledDate.slice(0, 16).replace('T', ' ')} · ${item.platform} · ${item.pillar} · ${item.title}`,
    );
  }
  console.log('plateformes :', JSON.stringify(tally('platform')));
  console.log('formats     :', JSON.stringify(tally('format')));
  console.log('statuts     :', JSON.stringify(tally('status')));
  console.log('piliers     :', JSON.stringify(tally('pillar')));
  if (warnings.length) {
    console.log('\nPoints à vérifier :');
    for (const warning of warnings) console.log(`- ${warning}`);
  }

  if (options.dryRun) {
    console.log('\n--dry-run : aucune écriture.');
    return;
  }
  if (mapped.items.length === 0) throw new Error('Aucun contenu lu : calendrier laissé intact.');

  const target = path.join(userData, 'clients', `${client.id}.json`);
  let previous = null;
  try {
    previous = await fs.readFile(target, 'utf8');
  } catch {
    /* premier import : rien à sauvegarder */
  }
  if (previous !== null) {
    const backup = `${target}.backup-${Date.now()}.json`;
    await fs.writeFile(backup, previous, 'utf8');
    console.log(`\nSauvegarde de l'ancien calendrier : ${backup}`);
  }

  const payload = { version: 1, updatedAt: new Date().toISOString(), items: mapped.items };
  await fs.mkdir(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(payload, null, 2), 'utf8');
  await fs.rename(tmp, target);
  console.log(`Calendrier écrit : ${target}`);
}

main().catch((error) => {
  console.error(`Échec : ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
