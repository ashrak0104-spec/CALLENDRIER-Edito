# Synchro Google Sheets — décision

Ce document fixe ce que « synchro » veut dire dans Editorial Studio, comment un dossier client
existant se rattache à un client de l'application, et ce qui se passe en cas de collision.

## 1. Décision : import à sens unique

**La feuille est la source de vérité de *qui sont les clients* ; l'application est la source de
vérité du *contenu éditorial*.**

- Sens unique : feuille → application. L'application **n'écrit jamais** dans la feuille.
  Le scope demandé reste `spreadsheets.readonly`.
- Ce que l'import met à jour : la liste des clients, leur nom affiché et leurs champs annexes
  (`fields`, ex. code interne, ville).
- Ce que l'import ne touche jamais : `items` (contenus), `checklist`, `assets`, `tags`,
  le client actif, les sauvegardes.
- Déclenchement : au démarrage de l'application et sur action manuelle (« Synchroniser »).
  L'import est **idempotent** : le relancer ne crée aucun doublon et ne modifie rien s'il n'y a
  aucun changement.
- « Synchroniser » ne fait aucun envoi réseau vers Google : c'est une lecture.

### Pourquoi pas de synchro bidirectionnelle

1. La feuille ne contient pas le modèle de l'application : un contenu a un statut, un pilier, un
   format, des tags, une checklist et des ressources ; la feuille n'a que des colonnes de texte.
   Écrire l'application dans la feuille perdrait de l'information.
2. La feuille est éditée par des humains, parfois en même temps que l'application tourne :
   il faudrait une colonne de version par ligne, une règle de résolution (dernière écriture ?
   dernière modification ?) et un journal d'écritures. Sans ça, une écriture automatique peut
   écraser un travail fait dans le tableur.
3. Le risque est asymétrique : une mauvaise lecture se corrige en relisant, une mauvaise écriture
   détruit des cellules.

Un export explicite (application → feuille) reste possible plus tard, sous conditions : scope
`spreadsheets`, colonne `ID` obligatoire, action manuelle « Exporter le planning », écriture
uniquement des colonnes connues, et jamais d'écriture automatique en arrière-plan.

## 2. Contrat avec la feuille

Onglet `Clients` (nom recommandé, `Sheet1` fonctionne aussi), avec au minimum une colonne de nom :

| ID       | Nom            | …colonnes libres |
| -------- | -------------- | ---------------- |
| CL-01    | Studio Lumène  | Paris            |
| CL-02    | Solaris        | Lyon             |

- **`Nom`** (ou `Client`, `Nom du client`, `Name`, `Raison sociale`) est obligatoire :
  sans cette colonne, l'import renvoie 0 client. Les autres colonnes sont conservées telles quelles
  dans `fields`, sans interprétation.
- **`ID`** (ou `Identifiant`, `Code`, `Slug`) est facultative mais **fortement recommandée** :
  c'est elle qui rend un renommage sans conséquence (voir §5).
- L'en-tête est cherché dans les 10 premières lignes ; les lignes au-dessus (titre, note) et
  les lignes sans nom sont ignorées.
- Plage lue par défaut : `Sheet1!A1:Z1000`, surchargeable par `range` dans
`userData/gsheet-config.json` (réglée sur `Clients!A1:Z1000` pour la feuille partagée).

État actuel de la feuille partagée (`1GQ3zne…`) : un seul onglet, `Éditorial & Statuts`, qui est la
grille de planning (`Date, Heure, Plateforme, Format, Pilier de Contenu, Accroche / Copywriting,
Visuel / Lien Asset, Statut, Commentaires / Notes`), **sans colonne client**. L'import renvoie donc
0 client — comportement attendu, pas une panne : l'onglet `Clients` reste à créer (l'intégration
Google Drive ne sait écrire que des cellules, pas créer d'onglet).

Attention : en mode `public`, l'export CSV de Google (`gviz`) ne signale pas un onglet inconnu — il
renvoie le **premier** onglet du classeur. Tant que `Clients` n'existe pas, la lecture réussit donc
(1 ligne, l'en-tête du planning) au lieu d'échouer, et le rapport affiche « aucune ligne client
reconnue ». Avec un compte de service ou OAuth, la même lecture renvoie une erreur 400 explicite
(`Unable to parse range`).

Les contenus de la grille de planning ne sont **pas** importés : le mapping colonnes → `PostItem`
(statuts, piliers, formats) est un sujet distinct, non décidé ici.

## 3. Clé de feuille et identifiant local

Pour chaque ligne, l'import calcule une clé stable :

```
sheetKey = slug(valeur de la colonne ID)   si la colonne existe
         = slug(nom)                       sinon

slug(v) = v sans accents (NFD), en minuscules, tout ce qui n'est pas [a-z0-9] → « - », bords nettoyés
clientId = "client_" + slug(valeur de la colonne ID ou du nom)
```

Exemples : `CL-01` → `client_cl-01` · `Studio Lumène` → `client_studio-lumene` ·
`Élodie & Fils` → `client_elodie-fils`.

Deux lignes qui produisent le même identifiant reçoivent un suffixe dans l'ordre du fichier :
`client_solaris`, `client_solaris-2`. Ces doublons sont signalés dans le rapport d'import.

La dérivation est déterministe : relire la feuille redonne les mêmes identifiants, donc les mêmes
fichiers `clients/<id>.json`. C'est ce qui rend l'import idempotent.

## 4. Correspondance avec les dossiers clients existants

Un dossier client de l'application, c'est une entrée dans `userData/clients.json` plus un fichier
`userData/clients/<clientId>.json`. Pour chaque ligne de la feuille, l'import cherche un client
existant dans cet ordre :

1. **Par lien mémorisé** — un client dont `sheetKey` (stocké dans `clients.json`) est égal à la clé
   de la ligne. C'est le cas normal pour un client déjà importé.
2. **Par identifiant dérivé** — un client local dont l'`id` est `client_<slug>` de la ligne.
3. **Par nom normalisé** — un **et un seul** client local dont le nom, une fois normalisé
   (minuscules, accents retirés, espaces compactés), est identique au nom de la ligne.
   Ce client est réutilisé : son `id` et son fichier de données ne bougent pas, et `sheetKey` est
   enregistré sur lui pour que les imports suivants passent par la règle 1.
4. **Aucun candidat** — un client est créé avec le nom de la feuille, calendrier vide (même
   comportement que « Nouveau client »).

Le rattachement ne déplace ni ne renomme jamais un fichier de données : un client existant garde
son `clientId`, donc son historique.

Cas particulier : **plusieurs** clients locaux portent le nom de la ligne (l'application autorise
les homonymes). L'import ne devine pas : la ligne est marquée « ambiguë » dans le rapport, aucun
client n'est créé ni fusionné, et la résolution est manuelle (renommer l'un des deux, ou fournir
une colonne `ID` dans la feuille).

## 5. Collisions : mêmes noms, mêmes identifiants

| Situation | Comportement décidé |
| --- | --- |
| Même `ID` / même `sheetKey` qu'un client local | Même client. Le **nom de la feuille est appliqué**, le contenu local reste intact. |
| Nom identique, `ID` différent | Pas de doublon : le client local existant est réutilisé (règle 3 du §4) et lié via `sheetKey`. |
| Nom renommé dans la feuille **avec** colonne `ID` | Le nom affiché suit la feuille ; l'`ID` ne change pas, donc aucun nouveau client. |
| Nom renommé dans la feuille **sans** colonne `ID` | Nouveau client `client_<nouveau-nom>` ; l'ancien reste, marqué `absent de la feuille`. C'est la raison d'être de la colonne `ID`. |
| Client local absent de la feuille | **Jamais supprimé.** Marqué `absent de la feuille` dans le picker ; ses contenus restent lisibles et modifiables. |
| Client supprimé dans l'application, encore dans la feuille | Il serait recréé (vide) au prochain import. Pour que la suppression tienne, sa `sheetKey` est ajoutée à `ignored` dans `gsheet-config.json` lors de la suppression. |
| Nom voulu différent dans l'application | `renameMap` (`{ "nom dans la feuille": "nom affiché" }`, dans `gsheet-config.json`) s'applique après le rattachement ; la clé de feuille reste l'identité. |
| Client actif devenu absent | Il reste actif jusqu'au prochain choix explicite ; aucune bascule automatique de contexte. |
| Ligne de la feuille illisible / vide | Ignorée (pas de nom) et comptée dans le rapport d'import. |

## 6. Où vit l'état de synchro

Tout reste local, dans `userData` :

- `clients.json` — chaque entrée peut porter `sheetKey?: string` (lien vers la feuille) et
  `sheetMissing?: boolean` (client plus présent dans la feuille). Champs optionnels : les clients
  créés à la main restent valides tel quels.
- `gsheet-config.json` — `spreadsheetId`, `range`, `auth`, plus `ignored?: string[]` (clés de
  feuille volontairement non importées, alimenté automatiquement quand un client importé est
  supprimé) et `renameMap?` (`{ "nom dans la feuille": "nom affiché" }`).
- Aucune donnée n'est écrite hors de `userData`, et aucune dans la feuille.

Le rapport d'import expose, pour l'interface : clients créés, clients mis à jour, clients
inchangés, lignes ambiguës, doublons de feuille, clients absents.

## 7. État d'implémentation

| Élément | État |
| --- | --- |
| Lecture de la feuille (public / compte de service / OAuth) | Fait — `electron/gsheet.js` |
| Contrat d'en-tête, dérivation d'`id`, suffixe anti-doublon | Fait — `parseSheetRows`, `electron/sheet-sync.js` |
| Création et rattachement des clients locaux (`sheetKey`, `sheetMissing`) | Fait — `planSheetSync` (pur) + `clients.syncFromSheet` |
| `ignored` (suppression définitive), `renameMap` | Fait — `gsheet-config.json`, `gsheet.addIgnored` |
| Rapport d'import, bouton « Synchroniser », import au démarrage | Fait — IPC `clients:sync-sheets`, `ClientSelectScreen` |
| Export application → feuille | Non retenu pour l'instant (§1) |

Le rattachement est calculé par `planSheetSync` (`electron/sheet-sync.js`), une fonction pure :
index `clients.json` + lignes de la feuille → nouvel index, clients à créer et rapport, sans aucune
écriture. `clients.syncFromSheet` applique ce plan : il écrit les calendriers vides des clients
nouveaux, met à jour `clients.json` seulement si quelque chose a changé, et ne touche jamais à un
fichier `clients/<id>.json` existant. L'interface n'a donc qu'un seul point d'entrée,
`clients:sync-sheets`, qui lit la feuille en lecture seule puis renvoie le rapport
(créés, mis à jour, inchangés, ambigus, doublons de feuille, absents, ignorés).

Le rapport distingue « mis à jour » (nom, champs ou lien de feuille modifiés, y compris la levée
du drapeau « absent ») de « inchangé ». Les lignes ambiguës ne créent et ne fusionnent rien : il
faut renommer l'un des homonymes locaux ou fournir une colonne `ID` dans la feuille.
