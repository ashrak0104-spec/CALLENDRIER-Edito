import { DEFAULT_ASSIGNEE, PLATFORMS } from '../constants';
import type { CalendarSyncReport } from './api';
import type { PostItem } from '../types';
import { uid } from './utils';

const TABS = ['Facebook', 'Instagram'] as const;
const DEFAULT_FORMAT = 'Post Texte';
const DEFAULT_STATUS = 'Idée / Backlog';
const DEFAULT_PILLAR = 'Éducation';

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index++;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index++;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    if (row.some((value) => value.trim())) rows.push(row);
  }
  return rows;
}

function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function dateStamp(value: string): string | null {
  const text = value.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  const french = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(text);
  const stamp = iso
    ? `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
    : french
      ? `${french[3]}-${french[2].padStart(2, '0')}-${french[1].padStart(2, '0')}`
      : '';
  if (!stamp) return null;
  const date = new Date(`${stamp}T00:00:00`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === Number(stamp.slice(0, 4)) &&
    date.getMonth() + 1 === Number(stamp.slice(5, 7)) &&
    date.getDate() === Number(stamp.slice(8, 10))
  )
    ? stamp
    : null;
}

function timeText(value: string): string | null {
  const found = /^(\d{1,2})(?:\s*[h:]\s*(\d{1,2})?(?::\d{1,2})?)?$/.exec(value.trim());
  if (!found) return null;
  const hours = Number(found[1]);
  const minutes = Number(found[2] || 0);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function firstValue(record: Map<string, string>, names: string[]): string {
  for (const name of names) {
    const value = record.get(normalizeHeader(name));
    if (value?.trim()) return value.trim();
  }
  return '';
}

function mapTab(title: (typeof TABS)[number], rows: string[][], warnings: string[]): PostItem[] {
  const headerRow = rows.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    return headers.includes('date') && (headers.includes('sujet') || headers.includes('titre'));
  });
  if (headerRow < 0) {
    warnings.push(`${title} : en-tête Date/Sujet introuvable, onglet ignoré.`);
    return [];
  }

  const headers = rows[headerRow].map(normalizeHeader);
  const items: PostItem[] = [];
  for (const values of rows.slice(headerRow + 1)) {
    const record = new Map(headers.map((header, index) => [header, values[index] ?? '']));
    const titleText = firstValue(record, ['Sujet', 'Titre', 'Title']);
    if (!titleText) continue;

    const rawDate = firstValue(record, ['Date']);
    const date = dateStamp(rawDate);
    if (!date) {
      warnings.push(`${title} : date illisible pour « ${titleText} ».`);
      continue;
    }
    const rawTime = firstValue(record, ['Heure', 'Horaire']);
    const time = timeText(rawTime);
    if (rawTime && !time) warnings.push(`${title} : heure illisible pour « ${titleText} », 09:00 appliqué.`);

    const rawFormat = firstValue(record, ['Format']).toLowerCase();
    const format = /carrousel/i.test(rawFormat)
      ? 'Carrousel'
      : /reel|vid[ée]o/i.test(rawFormat)
        ? 'Vidéo courte/Reel'
        : /infographie/i.test(rawFormat)
          ? 'Infographie'
          : /podcast/i.test(rawFormat)
            ? 'Podcast'
            : /article|blog/i.test(rawFormat)
              ? 'Article'
              : DEFAULT_FORMAT;

    const rawStatus = firstValue(record, ['Statut', 'Status']).toLowerCase();
    const status = /publi[ée]/i.test(rawStatus)
      ? 'Publié'
      : /programm|planifi/i.test(rawStatus)
        ? 'Programmé'
        : /valid[ée]|pr[êe]t/i.test(rawStatus)
          ? 'Validé / Prêt'
          : /r[ée]vision|relecture/i.test(rawStatus)
            ? 'En révision'
            : /r[ée]daction|cr[ée]ation|en cours/i.test(rawStatus)
              ? 'Rédaction / Création'
              : DEFAULT_STATUS;

    const goal = firstValue(record, ['Objectif']).toLowerCase();
    const pillar = /visibilit|identit|notori/i.test(goal)
      ? 'Autorité'
      : /vente|commande|offre|conversion/i.test(goal)
        ? 'Conversion'
        : /coulisse|storytelling|derri[èe]re/i.test(goal)
          ? 'Coulisses/Storytelling'
          : /int[ée]r[êe]t|produit|r[ée]f[ée]rence|d[ée]couverte|diversit/i.test(goal)
            ? 'Éducation'
            : /nouveaut|actualit/i.test(goal)
              ? 'Actualité'
              : DEFAULT_PILLAR;

    const ref = firstValue(record, ['Ref', 'ID', 'Identifiant']);
    const stablePart = (ref || `${date}-${titleText}`)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const now = new Date().toISOString();
    const product = firstValue(record, ['Produit / univers', 'Produit', 'Univers']);
    const rawPlatform = firstValue(record, ['Plateforme', 'Platform']);
    const platform = PLATFORMS.find((entry) => entry.toLowerCase() === rawPlatform.toLowerCase()) ?? title;

    items.push({
      id: `sheet_${title.toLowerCase()}_${stablePart || uid()}`,
      title: titleText,
      content: firstValue(record, ['Contenu éditorial', 'Contenu', 'Copy']),
      platform,
      format,
      status,
      pillar,
      scheduledDate: `${date}T${time ?? '09:00'}:00`,
      assignee: firstValue(record, ['Responsable', 'Assignee']) || DEFAULT_ASSIGNEE,
      tags: product ? [product] : [],
      checklist: [],
      assets: [],
      createdAt: now,
      updatedAt: now,
    });
  }
  return items;
}

export async function importPublicCalendar(sheetId: string): Promise<{
  items: PostItem[];
  report: CalendarSyncReport;
}> {
  const warnings: string[] = [];
  const items: PostItem[] = [];
  for (const tab of TABS) {
    const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
    const response = await fetch(url);
    if (!response.ok) {
      warnings.push(`${tab} : lecture impossible (${response.status}).`);
      continue;
    }
    const text = await response.text();
    if (/^\s*</.test(text)) {
      warnings.push(`${tab} : onglet privé ou inaccessible publiquement.`);
      continue;
    }
    items.push(...mapTab(tab, parseCsv(text), warnings));
  }
  if (items.length === 0) {
    throw new Error(
      warnings.length
        ? warnings.slice(0, 3).join(' ')
        : 'Aucun contenu valide trouvé dans les onglets Facebook et Instagram.',
    );
  }
  items.sort(
    (a, b) => new Date(a.scheduledDate ?? 0).getTime() - new Date(b.scheduledDate ?? 0).getTime(),
  );
  const platforms = items.reduce<Record<string, number>>((counts, item) => {
    counts[item.platform] = (counts[item.platform] ?? 0) + 1;
    return counts;
  }, {});
  return {
    items,
    report: {
      items: items.length,
      days: new Set(items.map((item) => item.scheduledDate?.slice(0, 10))).size,
      platforms,
      warnings,
      backup: null,
      sheetId,
    },
  };
}
