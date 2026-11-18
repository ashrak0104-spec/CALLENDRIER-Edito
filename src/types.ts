export type Platform =
  | 'LinkedIn'
  | 'Facebook'
  | 'Instagram'
  | 'TikTok'
  | 'YouTube'
  | 'Blog/SEO'
  | 'Newsletter'
  | 'X/Twitter';

export type Format =
  | 'Carrousel'
  | 'Vidéo courte/Reel'
  | 'Article'
  | 'Post Texte'
  | 'Infographie'
  | 'Podcast';

export type Status =
  | 'Idée / Backlog'
  | 'Rédaction / Création'
  | 'En révision'
  | 'Validé / Prêt'
  | 'Programmé'
  | 'Publié';

export type Pillar =
  | 'Éducation'
  | 'Autorité'
  | 'Coulisses/Storytelling'
  | 'Conversion'
  | 'Actualité';

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface AssetRef {
  id: string;
  label: string;
  target: string;
  kind: 'file' | 'link';
}

export interface PostItem {
  id: string;
  title: string;
  content: string;
  platform: Platform;
  format: Format;
  status: Status;
  pillar: Pillar;
  /** ISO 8601 datetime, or null when the post is not scheduled yet. */
  scheduledDate: string | null;
  assignee: string;
  tags: string[];
  checklist: ChecklistItem[];
  assets: AssetRef[];
  createdAt: string;
  updatedAt: string;
}

export interface EditorialPayload {
  version: number;
  updatedAt: string;
  items: PostItem[];
}

export type ViewId = 'calendar' | 'kanban' | 'table' | 'dashboard';

export type DrawerTab = 'edit' | 'preview';
