import { FORMATS, PILLARS, PLATFORMS, STATUSES } from '../constants';
import type { AssetRef, ChecklistItem, PostItem } from '../types';
import { uid } from './utils';

function inList<T extends string>(list: readonly T[], value: unknown, fallback: T): T {
  return typeof value === 'string' && (list as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function sanitizeChecklist(raw: unknown): ChecklistItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const value = entry as Record<string, unknown>;
      const text = stringValue(value.text).trim();
      if (!text) return null;
      return {
        id: stringValue(value.id) || uid(),
        text,
        done: Boolean(value.done),
      } satisfies ChecklistItem;
    })
    .filter((entry): entry is ChecklistItem => entry !== null);
}

function sanitizeAssets(raw: unknown): AssetRef[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const value = entry as Record<string, unknown>;
      const target = stringValue(value.target).trim();
      if (!target) return null;
      const kind = value.kind === 'file' ? 'file' : 'link';
      return {
        id: stringValue(value.id) || uid(),
        label: stringValue(value.label).trim() || target,
        target,
        kind,
      } satisfies AssetRef;
    })
    .filter((entry): entry is AssetRef => entry !== null);
}

function sanitizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(
      raw
        .filter((tag): tag is string => typeof tag === 'string')
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ).slice(0, 24);
}

export function normalizeItem(raw: unknown): PostItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const title = stringValue(value.title);
  const content = stringValue(value.content);
  if (!title && !content && !value.id) return null;

  const now = new Date().toISOString();
  const scheduledRaw = stringValue(value.scheduledDate);
  const scheduledDate =
    scheduledRaw && !Number.isNaN(new Date(scheduledRaw).getTime()) ? scheduledRaw : null;

  return {
    id: stringValue(value.id) || uid(),
    title,
    content,
    platform: inList(PLATFORMS, value.platform, 'LinkedIn'),
    format: inList(FORMATS, value.format, 'Post Texte'),
    status: inList(STATUSES, value.status, 'Idée / Backlog'),
    pillar: inList(PILLARS, value.pillar, 'Éducation'),
    scheduledDate,
    assignee: stringValue(value.assignee),
    tags: sanitizeTags(value.tags),
    checklist: sanitizeChecklist(value.checklist),
    assets: sanitizeAssets(value.assets),
    createdAt: stringValue(value.createdAt) || now,
    updatedAt: stringValue(value.updatedAt) || now,
  };
}

export function normalizeItems(raw: unknown): PostItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeItem).filter((item): item is PostItem => item !== null);
}

/**
 * Accepts a raw array or a `{ version, items }` payload. Returns null when the
 * shape is not recognised, and `[]` for a deliberately empty workspace.
 */
export function parsePayload(raw: unknown): PostItem[] | null {
  if (Array.isArray(raw)) return normalizeItems(raw);
  if (raw && typeof raw === 'object' && Array.isArray((raw as { items?: unknown }).items)) {
    return normalizeItems((raw as { items: unknown }).items);
  }
  return null;
}
