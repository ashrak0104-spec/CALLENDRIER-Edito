import type { PostItem } from '../types';
import { bySchedule } from './utils';

const HEADERS = [
  'Titre',
  'Statut',
  'Plateforme',
  'Format',
  'Pilier éditorial',
  'Date planifiée',
  'Auteur',
  'Tags',
  'Checklist',
  'Ressources',
  'Contenu',
];

function escapeCell(value: string): string {
  return `"${value.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
}

function formatDate(value: string | null): string {
  if (!value) return 'Non planifié';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Non planifié';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/** Semicolon-separated CSV, Excel-friendly for French locales. */
export function buildCsv(items: PostItem[]): string {
  const rows = [...items].sort(bySchedule).map((item) => {
    const done = item.checklist.filter((task) => task.done).length;
    return [
      item.title || 'Sans titre',
      item.status,
      item.platform,
      item.format,
      item.pillar,
      formatDate(item.scheduledDate),
      item.assignee,
      item.tags.join(', '),
      `${done}/${item.checklist.length}`,
      item.assets.map((asset) => asset.target).join(' | '),
      item.content,
    ]
      .map((cell) => escapeCell(cell))
      .join(';');
  });

  return [HEADERS.map(escapeCell).join(';'), ...rows].join('\r\n');
}

export function csvFileName(): string {
  const date = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `planning-editorial-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}.csv`;
}
