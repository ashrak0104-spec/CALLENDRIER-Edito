'use strict';

/**
 * Convertit un planning éditorial au format CSV (colonnes de la grille Google Sheets)
 * en sauvegarde importable par l'application :
 *
 *   node scripts/import-planning.js <source.csv> <sortie.json> [responsable]
 *
 * Pour lire directement une feuille Google, préférez
 * `scripts/sync-planning-sheet.js`, qui écrit dans le calendrier d'un client.
 *
 * Les règles de traduction (plateforme, format, statut, pilier) sont partagées avec
 * l'import de feuille : voir `electron/planning-sync.js`.
 */

const fs = require('node:fs/promises');
const path = require('node:path');
const { parseCsv } = require('../electron/gsheet');
const { toRecord, toItem, pick } = require('../electron/planning-sync');

async function main() {
  const [source, target, assigneeArg] = process.argv.slice(2);
  if (!source || !target) {
    console.error('Usage : node scripts/import-planning.js <source.csv> <sortie.json> [responsable]');
    process.exitCode = 1;
    return;
  }

  const rows = parseCsv(await fs.readFile(path.resolve(source), 'utf8'));
  if (rows.length < 2) {
    console.error('Source vide : aucune ligne de planning.');
    process.exitCode = 1;
    return;
  }

  const header = rows[0];
  const now = new Date().toISOString();
  const items = [];
  const skipped = [];
  const warnings = new Map();
  const warn = (message) => warnings.set(message, (warnings.get(message) ?? 0) + 1);

  for (const values of rows.slice(1)) {
    const record = toRecord(header, values);
    if (!values.some((cell) => String(cell ?? '').trim() !== '')) continue;
    const result = toItem(record, {
      assignee: pick(record, 'assignee') || assigneeArg || '',
      now,
    });
    if (result.error) {
      skipped.push(result.error);
      continue;
    }
    for (const message of result.warnings ?? []) warn(message);
    items.push(result.item);
  }

  items.sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());

  const payload = { version: 1, updatedAt: now, items };
  const output = path.resolve(target);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const tally = (field) =>
    items.reduce((counts, item) => {
      counts[item[field]] = (counts[item[field]] ?? 0) + 1;
      return counts;
    }, {});

  console.log(`${items.length} contenu(s) écrit(s) dans ${output}`);
  console.log('plateformes :', JSON.stringify(tally('platform')));
  console.log('formats     :', JSON.stringify(tally('format')));
  console.log('statuts     :', JSON.stringify(tally('status')));
  console.log('piliers     :', JSON.stringify(tally('pillar')));
  if (skipped.length) console.log('lignes ignorées :', skipped.join(' | '));
  for (const [message, count] of warnings) console.log(`avertissement (${count}) : ${message}`);
}

main().catch((error) => {
  console.error(`Échec : ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
