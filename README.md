# Editorial Studio

Application desktop (Electron + React + TypeScript) pour planifier et suivre la production de
contenus éditoriaux, avec un calendrier indépendant par client.

## Lancer

```bash
npm install
npm run dev     # Vite + Electron avec rechargement
npm start       # Electron sur le build de dist/
npm run build   # vérification TypeScript + build Vite
```

## Installateur Windows

```bash
npm run dist      # NSIS dans release/
npm run dist:dir  # version non empaquetée
```

## Données

Tout est local, dans `userData` (`%APPDATA%\Editorial Studio` sous Windows) :

- `clients.json` — index des clients et client actif ;
- `clients/<id>.json` — un fichier par client (contenus) ;
- `backups/` — copies `.preserved-*` créées avant une restauration ou un démarrage à vide.

Un fichier client absent ou illisible n'est jamais écrasé : l'application bloque la sauvegarde et
propose de réessayer, restaurer une sauvegarde ou repartir d'un calendrier vide.

## Fonctionnalités

- Choix du client à l'ouverture, création, renommage et suppression (avec confirmation).
- Quatre vues : calendrier mensuel, pipeline Kanban, base filtrable et dashboard.
- Édition dans un panneau latéral : statut, pilier, plateforme, format, checklist, ressources.
- Sauvegarde automatique par client, export/restauration JSON et export CSV.

## Structure

```
electron/   processus principal : stockage par client, sauvegardes, IPC
src/        interface React : vues, composants, store
scripts/    génération de l'icône
```
