import type {
  ChecklistItem,
  Format,
  Pillar,
  Platform,
  PostItem,
  Status,
} from '../types';
import { startOfDay } from './dates';
import { uid } from './utils';

interface SeedSpec {
  day: number;
  hour: number;
  minute?: number;
  title: string;
  content: string;
  platform: Platform;
  format: Format;
  pillar: Pillar;
  assignee: string;
  tags: string[];
  checklist: Array<[string, boolean]>;
  assets?: Array<{ label: string; target: string }>;
}

const SPECS: SeedSpec[] = [
  {
    day: 2,
    hour: 8,
    minute: 30,
    title: 'Les 5 erreurs qui plombent un calendrier éditorial',
    content: `La plupart des créateurs ne manquent pas d'idées. Ils manquent de système.

Voici les 5 erreurs que je corrige en premier quand j'audite un calendrier éditorial :

1. Publier au rythme de l'inspiration plutôt qu'à celui de la stratégie.
2. Confondre fréquence et régularité : mieux vaut 3 posts tenus que 10 abandonnés.
3. Ne jamais recycler un contenu qui a fonctionné.
4. Planifier sans pilier éditorial — donc sans cap, donc sans autorité.
5. Oublier de mesurer : sans données, on répète ses intuitions au lieu de progresser.

Le calendrier n'est pas une contrainte. C'est ce qui vous libère du « je posterai demain ».

Et vous, laquelle de ces erreurs vous coûte le plus de temps ?`,
    platform: 'LinkedIn',
    format: 'Post Texte',
    pillar: 'Éducation',
    assignee: 'Niaina',
    tags: ['stratégie', 'organisation', 'calendrier'],
    checklist: [
      ['Recherche et sources vérifiées', true],
      ['Relecture orthographique', true],
      ['Visuel / média prêt', false],
      ['Publication planifiée', false],
    ],
    assets: [{ label: 'Brief complet (Notion)', target: 'https://www.notion.so' }],
  },
  {
    day: 4,
    hour: 12,
    minute: 15,
    title: "7 hooks pour capter l'attention en 3 secondes",
    content: `Le premier slide décide de tout.

7 accroches à tester dès cette semaine :

→ « Arrêtez de faire ça sur LinkedIn. »
→ « J'ai testé pendant 30 jours. Voici le résultat. »
→ « Personne ne vous dira ça, alors je le fais. »
→ « 3 chiffres qui m'ont fait changer d'avis. »
→ « La vérité sur un sujet qui fâche. »
→ « Si vous ne lisez qu'un post cette semaine, prenez celui-ci. »
→ « Voici exactement ce que j'aurais aimé savoir il y a 2 ans. »

Enregistrez ce carrousel et testez une accroche sur votre prochaine publication.`,
    platform: 'Instagram',
    format: 'Carrousel',
    pillar: 'Éducation',
    assignee: 'Léa',
    tags: ['copywriting', 'instagram', 'hooks'],
    checklist: [
      ['Structure des 10 slides', true],
      ['Direction artistique validée', false],
      ['Légende + hashtags', false],
    ],
  },
  {
    day: 6,
    hour: 18,
    title: "Ce que 3 ans de publication régulière m'ont appris",
    content: `3 ans de posts réguliers. 4 leçons que personne ne m'avait données :

1. La constance bat le talent.
2. Un bon sujet vaut mieux qu'une belle écriture.
3. Les posts qui marchent sont ceux qu'on ose publier.
4. La communauté se construit dans les commentaires, pas dans le feed.

Le meilleur moment pour commencer était il y a 3 ans. Le deuxième, c'est aujourd'hui.`,
    platform: 'X/Twitter',
    format: 'Post Texte',
    pillar: 'Autorité',
    assignee: 'Niaina',
    tags: ['personal branding', 'régularité'],
    checklist: [
      ['Angle validé', true],
      ['Relecture', true],
    ],
  },
  {
    day: 8,
    hour: 10,
    title: "Dans les coulisses d'un lancement à 40 k€",
    content: `Script vidéo (90 s) :

0-5 s — Plan serré sur l'écran de vente qui vient d'être mis en ligne.
5-20 s — « Ce lancement a rapporté 40 000 € en 9 jours. Voici ce que personne ne montre. »
20-45 s — Les 3 semaines de préparation : liste d'attente, 4 e-mails, 1 webinaire.
45-70 s — L'erreur du jour 2 (page de vente trop longue) et la correction.
70-90 s — Résultat, apprentissage clé, appel à commenter.

B-roll : bureau, timeline, graphiques de ventes.
Sous-titres obligatoires, accroche visuelle dans les 2 premières secondes.`,
    platform: 'YouTube',
    format: 'Vidéo courte/Reel',
    pillar: 'Coulisses/Storytelling',
    assignee: 'Sarah',
    tags: ['coulisses', 'lancement', 'youtube'],
    checklist: [
      ['Script validé', true],
      ['Tournage', true],
      ['Montage', false],
      ['Miniature', false],
    ],
    assets: [{ label: 'Storyboard', target: 'https://www.figma.com' }],
  },
  {
    day: 10,
    hour: 9,
    title: 'Guide complet : structurer son calendrier éditorial',
    content: `Un calendrier éditorial utile tient sur trois éléments : des piliers, un rythme et un workflow.

1. Les piliers — 4 à 5 thèmes maximum, chacun avec un objectif (éduquer, prouver, convertir).
2. Le rythme — un nombre de publications que vous pouvez tenir 6 mois, pas 6 jours.
3. Le workflow — Idée → Rédaction → Révision → Validation → Programmé → Publié.

Ajoutez une revue mensuelle : qu'est-ce qui a performé ? Qu'est-ce qu'on recycle ? Qu'est-ce qu'on arrête ?

Ce guide détaille chaque étape avec des exemples de calendriers pour une activité solo et pour une équipe de 4 personnes.`,
    platform: 'Blog/SEO',
    format: 'Article',
    pillar: 'Autorité',
    assignee: 'Niaina',
    tags: ['seo', 'guide', 'workflow'],
    checklist: [
      ['Plan détaillé', true],
      ['Rédaction 1 500 mots', true],
      ['Optimisation SEO', false],
      ['Images + maillage interne', false],
    ],
  },
  {
    day: 12,
    hour: 7,
    minute: 30,
    title: "L'offre de novembre (et pourquoi elle part vite)",
    content: `Objet : 12 places, pas une de plus

Bonjour,

J'ouvre 12 places pour l'accompagnement éditorial du mois. Pourquoi si peu ? Parce que chaque audit prend 3 heures et que je préfère livrer un travail utile plutôt qu'un volume.

Ce que vous obtenez :
• Un audit de vos 20 derniers contenus
• Un calendrier de 90 jours prêt à exécuter
• 2 sessions de travail en visio

Tarif : 890 € HT. Démarrage en fin de mois.

Répondez simplement « OK » à cet e-mail pour recevoir le lien de réservation.`,
    platform: 'Newsletter',
    format: 'Post Texte',
    pillar: 'Conversion',
    assignee: 'Niaina',
    tags: ['newsletter', 'offre', 'conversion'],
    checklist: [
      ['Copy relue', true],
      ['Lien de réservation testé', false],
      ["Segment d'envoi", false],
    ],
  },
  {
    day: 14,
    hour: 17,
    minute: 30,
    title: "Une journée dans la peau d'un créateur de contenu",
    content: `Storyboard :

07:00 — Réveil, téléphone en mode avion (plan sur le réveil).
08:00 — Revue des analytics de la veille, 3 captures.
09:30 — Écriture du script du jour, gros plan sur le carnet.
12:00 — Tournage : 4 prises, 1 gardée.
15:00 — Montage, sous-titres, miniature.
18:30 — Publication et réponses aux commentaires.

Voix off : « Le mythe du créateur qui poste quand il en a envie. La réalité, c'est un métier avec des horaires. »

Format vertical 9:16, 45 s, sous-titres intégrés.`,
    platform: 'TikTok',
    format: 'Vidéo courte/Reel',
    pillar: 'Coulisses/Storytelling',
    assignee: 'Sarah',
    tags: ['coulisses', 'routine', 'tiktok'],
    checklist: [
      ['Storyboard', true],
      ['Tournage', false],
      ['Sous-titres', false],
    ],
  },
  {
    day: 16,
    hour: 11,
    title: 'Notre process de production en 6 étapes',
    content: `De l'idée à la publication, notre process tient en 6 étapes :

1. Idée capturée dans le backlog (jamais perdue).
2. Angle validé en 10 minutes : promesse, preuve, appel à l'action.
3. Rédaction avec un brief de 5 lignes.
4. Révision par une deuxième personne.
5. Programmation et checklist de publication.
6. Analyse à J+7 : on garde, on recycle ou on arrête.

Infographie : 1 bloc par étape, pictogramme, une seule couleur d'accent. Format 1200 × 1500.`,
    platform: 'LinkedIn',
    format: 'Infographie',
    pillar: 'Conversion',
    assignee: 'Léa',
    tags: ['process', 'production', 'infographie'],
    checklist: [
      ['Données du process', true],
      ['Design infographie', true],
      ['Relecture finale', false],
    ],
    assets: [{ label: 'Maquette Figma', target: 'https://www.figma.com' }],
  },
  {
    day: 19,
    hour: 18,
    minute: 45,
    title: 'Ce qui change sur Instagram ce mois-ci',
    content: `3 changements à intégrer dans votre stratégie dès maintenant :

1. Les carrousels sont à nouveau mieux distribués que les photos seules : privilégiez 8 à 10 slides.
2. Les sous-titres générés automatiquement progressent : vérifiez-les, ils sont encore imparfaits.
3. La sauvegarde devient un signal fort : proposez un contenu que l'on garde, pas seulement que l'on aime.

Ce que ça change pour vous : moins de volume, plus de valeur par publication.

Sources : notes de version et tests internes sur 12 comptes.`,
    platform: 'Instagram',
    format: 'Carrousel',
    pillar: 'Actualité',
    assignee: 'Léa',
    tags: ['actualité', 'instagram', 'algorithme'],
    checklist: [
      ['Vérification des sources', true],
      ['Slides', false],
      ['Date de publication confirmée', false],
    ],
  },
  {
    day: 22,
    hour: 7,
    minute: 30,
    title: 'Le template Notion qui a remplacé 3 outils',
    content: `Pendant deux ans, j'ai jonglé entre un tableur, une app de notes et un outil de gestion de projet. Aujourd'hui, tout tient dans une seule base :

• Vue calendrier pour planifier
• Vue kanban pour produire
• Vue tableau pour filtrer
• Vue dashboard pour décider

Le principe : une ligne = un contenu, avec son statut, son pilier, sa date et sa checklist.

Je partage le template avec les abonnés de la newsletter. Répondez à cet e-mail si vous le voulez.`,
    platform: 'Newsletter',
    format: 'Post Texte',
    pillar: 'Éducation',
    assignee: 'Niaina',
    tags: ['notion', 'template', 'productivité'],
    checklist: [
      ["Capture d'écran", true],
      ['Lien de duplication', false],
    ],
  },
  {
    day: 25,
    hour: 9,
    minute: 15,
    title: 'Étude de cas : +180 % de trafic en 90 jours',
    content: `Contexte : une PME de conseil, 40 articles publiés en 3 ans, 1 200 visites/mois.

Le diagnostic : aucun maillage interne, 12 sujets qui se cannibalisent, pas de pages de conversion.

Le plan sur 90 jours :
• Semaines 1-2 : audit et fusion de 5 articles redondants.
• Semaines 3-6 : 8 articles sur des requêtes à intention commerciale.
• Semaines 7-12 : maillage interne systématique + 3 études de cas.

Résultat à J+90 : 3 360 visites/mois, 14 demandes entrantes qualifiées.

Ce qui a le plus compté ? La réécriture des titres et le maillage, pas le volume.`,
    platform: 'Blog/SEO',
    format: 'Article',
    pillar: 'Conversion',
    assignee: 'Niaina',
    tags: ['seo', 'étude de cas', 'résultats'],
    checklist: [
      ['Accord client', true],
      ['Chiffres vérifiés', true],
      ['Publication + schema', false],
    ],
  },
  {
    day: 28,
    hour: 18,
    title: "Interview : bâtir une audience sans publicité",
    content: `Épisode 42 — Invité : Marc, créateur de contenu B2B, 85 000 abonnés.

Chapitres :
00:00 Intro et parcours
04:12 Les 100 premiers abonnés
11:40 Pourquoi il a arrêté la publicité
18:05 Son système de production (2 h par semaine)
27:30 La newsletter comme actif principal
34:10 Conseils pour quelqu'un qui commence seul

Matériel : 2 micros cardioïdes, fond neutre, lumière à 45°.
Extraits verticaux : 3 clips de 45 s pour TikTok et Reels.`,
    platform: 'YouTube',
    format: 'Podcast',
    pillar: 'Autorité',
    assignee: 'Sarah',
    tags: ['podcast', 'audience', 'b2b'],
    checklist: [
      ['Montage audio', true],
      ['Chapitres', false],
      ['3 clips verticaux', false],
    ],
  },
];

const WORKFLOW: Status[] = [
  'Programmé',
  'Validé / Prêt',
  'En révision',
  'Rédaction / Création',
  'Idée / Backlog',
];

function checklistOf(entries: Array<[string, boolean]>): ChecklistItem[] {
  return entries.map(([text, done]) => ({ id: uid(), text, done }));
}

/**
 * 12 realistic posts spread across the current month. Past dates are marked
 * published, upcoming ones walk through the whole workflow so the pipeline,
 * calendar and dashboard are immediately meaningful.
 */
export function buildSeedData(now: Date = new Date()): PostItem[] {
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = startOfDay(now).getTime();
  const lastDay = new Date(year, month + 1, 0).getDate();

  const items: Array<{ date: Date; item: PostItem }> = SPECS.map((spec) => {
    const day = Math.min(spec.day, lastDay);
    const scheduled = new Date(year, month, day, spec.hour, spec.minute ?? 0, 0, 0);
    const createdAt = new Date(year, month, Math.max(1, day - 3), 9, 0, 0, 0);
    return {
      date: scheduled,
      item: {
        id: uid(),
        title: spec.title,
        content: spec.content,
        platform: spec.platform,
        format: spec.format,
        status: 'Publié',
        pillar: spec.pillar,
        scheduledDate: scheduled.toISOString(),
        assignee: spec.assignee,
        tags: [...spec.tags],
        checklist: checklistOf(spec.checklist),
        assets: (spec.assets ?? []).map((asset) => ({
          id: uid(),
          label: asset.label,
          target: asset.target,
          kind: 'link' as const,
        })),
        createdAt: createdAt.toISOString(),
        updatedAt: now.toISOString(),
      } satisfies PostItem,
    };
  });

  items.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Past dates are published; upcoming ones walk the pipeline in date order.
  // Missing statuses (end of month) are filled from the most recent past posts
  // so every pipeline column still has content on first launch.
  items.forEach((entry) => {
    entry.item.status = 'Publié';
  });
  const upcoming = items.filter((entry) => entry.date.getTime() >= today);
  upcoming.forEach((entry, index) => {
    entry.item.status = WORKFLOW[Math.min(index, WORKFLOW.length - 1)];
  });

  const past = items.filter((entry) => entry.date.getTime() < today).reverse();
  WORKFLOW.slice(upcoming.length).forEach((status, index) => {
    const entry = past[index];
    if (entry) entry.item.status = status;
  });

  return items.map((entry) => entry.item);
}
