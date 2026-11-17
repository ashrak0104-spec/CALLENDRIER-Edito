import type { Format, Pillar, Platform, Status } from './types';

export const PLATFORMS: readonly Platform[] = [
  'LinkedIn',
  'Instagram',
  'TikTok',
  'YouTube',
  'Blog/SEO',
  'Newsletter',
  'X/Twitter',
];

export const FORMATS: readonly Format[] = [
  'Carrousel',
  'Vidéo courte/Reel',
  'Article',
  'Post Texte',
  'Infographie',
  'Podcast',
];

export const STATUSES: readonly Status[] = [
  'Idée / Backlog',
  'Rédaction / Création',
  'En révision',
  'Validé / Prêt',
  'Programmé',
  'Publié',
];

export const PILLARS: readonly Pillar[] = [
  'Éducation',
  'Autorité',
  'Coulisses/Storytelling',
  'Conversion',
  'Actualité',
];

export const PLATFORM_META: Record<Platform, { color: string; limit: number; short: string }> = {
  LinkedIn: { color: '#0A66C2', limit: 3000, short: 'LinkedIn' },
  Instagram: { color: '#E1306C', limit: 2200, short: 'Instagram' },
  TikTok: { color: '#FE2C55', limit: 2200, short: 'TikTok' },
  YouTube: { color: '#FF0000', limit: 5000, short: 'YouTube' },
  'Blog/SEO': { color: '#7C3AED', limit: 12000, short: 'Blog' },
  Newsletter: { color: '#F59E0B', limit: 5000, short: 'Newsletter' },
  'X/Twitter': { color: '#1F2937', limit: 280, short: 'X' },
};

export const PILLAR_META: Record<Pillar, { color: string; family: 'valeur' | 'vente' }> = {
  Éducation: { color: '#6366F1', family: 'valeur' },
  Autorité: { color: '#0EA5E9', family: 'valeur' },
  'Coulisses/Storytelling': { color: '#F59E0B', family: 'valeur' },
  Conversion: { color: '#10B981', family: 'vente' },
  Actualité: { color: '#EC4899', family: 'valeur' },
};

export const STATUS_META: Record<Status, { color: string; hint: string }> = {
  'Idée / Backlog': { color: '#94A3B8', hint: 'Idées capturées, non démarrées' },
  'Rédaction / Création': { color: '#6366F1', hint: 'En cours de production' },
  'En révision': { color: '#F59E0B', hint: 'En attente de relecture' },
  'Validé / Prêt': { color: '#10B981', hint: 'Prêt à programmer' },
  Programmé: { color: '#0EA5E9', hint: 'Date planifiée' },
  Publié: { color: '#8B5CF6', hint: 'En ligne' },
};

export const STATUS_ORDER: Record<Status, number> = {
  'Idée / Backlog': 0,
  'Rédaction / Création': 1,
  'En révision': 2,
  'Validé / Prêt': 3,
  Programmé: 4,
  Publié: 5,
};

export const DEFAULT_ASSIGNEE = 'Studio éditorial';
