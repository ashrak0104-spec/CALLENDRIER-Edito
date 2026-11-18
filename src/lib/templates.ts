import { FORMATS, PILLARS, PLATFORMS } from '../constants';
import type { Format, Pillar, Platform, PostItem } from '../types';
import { uid } from './utils';

const STORAGE_KEY = 'editorial-studio:templates:v1';

export interface ContentTemplate {
  id: string;
  name: string;
  title: string;
  content: string;
  platform: Platform;
  format: Format;
  pillar: Pillar;
  assignee: string;
  tags: string[];
  checklist: string[];
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isTemplate(value: unknown): value is ContentTemplate {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.name === 'string' &&
    typeof entry.title === 'string' &&
    typeof entry.content === 'string' &&
    (PLATFORMS as readonly string[]).includes(String(entry.platform)) &&
    (FORMATS as readonly string[]).includes(String(entry.format)) &&
    (PILLARS as readonly string[]).includes(String(entry.pillar)) &&
    typeof entry.assignee === 'string' &&
    isStringArray(entry.tags) &&
    isStringArray(entry.checklist)
  );
}

export function readTemplates(): ContentTemplate[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every(isTemplate)) {
    throw new Error('La bibliothèque de modèles contient des données invalides.');
  }
  return parsed;
}

export function writeTemplates(templates: ContentTemplate[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export function templateFromItem(name: string, item: PostItem): ContentTemplate {
  return {
    id: uid(),
    name: name.trim(),
    title: item.title,
    content: item.content,
    platform: item.platform,
    format: item.format,
    pillar: item.pillar,
    assignee: item.assignee,
    tags: [...item.tags],
    checklist: item.checklist.map((task) => task.text),
  };
}
