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

## Version Android (APK de test)

Le projet Android utilise l’interface React et conserve ses données localement sur le téléphone.
Il peut importer le calendrier des onglets Facebook et Instagram depuis le lien public associé au
client. Chaque client conserve son propre lien ; les modifications locales ne sont pas envoyées à
Google Sheets. Les feuilles privées configurées par OAuth restent réservées à la version Windows.
La sélection de fichiers propres à l’application Windows n’est pas disponible sur Android.

Prérequis : Android SDK (API 35) et Java 21, par exemple le JDK fourni avec Android Studio.
Définissez `ANDROID_HOME` vers votre dossier Android SDK, puis lancez :

```bash
npm run android:apk
```

L’APK de débogage signé pour les tests est généré dans
`android/app/build/outputs/apk/debug/app-debug.apk`. Il n’est pas signé pour le Play Store.

## Synchronisation Git dans VS Code

Le workspace lance la commande de synchronisation Git après chaque commit effectué dans VS Code
(`git.postCommitCommand: sync`). Selon la configuration du dépôt, cela peut envoyer le commit à
GitHub. Vérifiez les fichiers indexés avant de committer, en particulier les données de planning
dans `imports/`.

## Données

Tout est local, dans `userData` (`%APPDATA%\Editorial Studio` sous Windows) :

- `clients.json` — index des clients et client actif ;
- `clients/<id>.json` — un fichier par client (contenus) ;
- `backups/` — copies `.preserved-*` créées avant une restauration ou un démarrage à vide.

Un fichier client absent ou illisible n'est jamais écrasé : l'application bloque la sauvegarde et
propose de réessayer, restaurer une sauvegarde ou repartir d'un calendrier vide.

## Clients depuis Google Sheets

La liste des clients peut être lue depuis une feuille Google Sheets : la feuille fait foi pour
*qui sont les clients* et leur nom, l’application reste la seule source du contenu éditorial.
C’est un import à sens unique — rien n’est jamais écrit dans la feuille.

- Feuille, plage et mode d’authentification (lien public, compte de service ou OAuth) :
  `%APPDATA%\Editorial Studio\gsheet-config.json`, implémenté dans `electron/gsheet.js`.
- Import des clients : bouton « Synchroniser » du sélecteur de clients, plus un import silencieux au
  démarrage (lecture seule). Calcul du rattachement dans `electron/sheet-sync.js` ; les clients
  importés sont marqués dans `clients.json` (`sheetKey`, `sheetMissing`).
- Sémantique exacte (rattachement des dossiers clients, collisions de nom ou d’ID, clients
  absents) : [docs/sync-google-sheets.md](docs/sync-google-sheets.md).

## Fonctionnalités

- Choix du client à l'ouverture, création, renommage et suppression (avec confirmation).
- Quatre vues : calendrier mensuel, pipeline Kanban, base filtrable et dashboard.
- Édition dans un panneau latéral : statut, pilier, plateforme, format, checklist, ressources.
- Modèles réutilisables, rappels de retard et filtres par échéance.
- Sauvegardes automatiques quotidiennes (30 derniers jours), export/restauration JSON et export CSV.

## Structure

```
electron/   processus principal : stockage par client, sauvegardes, IPC
src/        interface React : vues, composants, store
docs/       décisions (synchro Google Sheets)
scripts/    génération de l'icône
```
