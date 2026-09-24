# OpenGym — Remplacement du catalogue d'exercices par les données SmartWorkout

Date : 2026-09-24
Branche : `swap-opengym-smartworkout`

## Contexte

OpenGym utilise aujourd'hui un catalogue de **1324 exercices** issu du dataset public
`hasaneyldrm/exercises-dataset` (licence CC) : nom, partie du corps, équipement, muscles
génériques, étapes texte, GIF/image. Contenu pauvre (pas de description, pas de conseils,
pas d'erreurs fréquentes), vidéo réelle disponible pour seulement 34% du catalogue via un
enrichissement partiel (`sw-enrichment.json`, 455/1324 exercices matchés par similarité de
nom).

Le projet **Anatomy Viewer** (`../anatomy-viewer`) contient déjà un catalogue **SmartWorkout**
(812 exercices) bien plus riche : description, instructions, tips, erreurs fréquentes,
activation musculaire précise en %, vidéos (CDN distant + fallback local), le tout **déjà
traduit en français à 100%** pour le contenu (pas les noms). Une vue exercices complète
(liste + filtres + panneau détail + lien vers la vue 3D) existe déjà dans Anatomy Viewer et
sert de référence.

**Objectif de ce chantier** : remplacer le catalogue d'exercices d'OpenGym par les données
SmartWorkout, avec vidéos, filtres et fiches détaillées équivalents à Anatomy Viewer, en
français, tout en gardant les exercices utilisables dans les programmes (création manuelle
et import Excel/CSV). L'intégration de la vue anatomique 3D (corps 3D, muscles cliquables,
double face avant/arrière) est un **chantier ultérieur, hors périmètre de cette spec**.

## Décisions actées (issues du brainstorming)

| Sujet | Décision |
|---|---|
| Migration des données existantes (historique, PRs, routines) | **Coupure nette** — pas de données réelles à préserver, pas de table de correspondance ancien/nouveau ID à construire |
| Langues du contenu | **Français + anglais uniquement** pour l'instant. Les 9 autres langues d'OpenGym gardent l'UI traduite mais retombent sur l'anglais pour le contenu d'exercice (pas de régression organisée, juste pas d'extension) |
| Noms d'exercices | **Restent en anglais** (usage courant en musculation/fitness FR : "Bench Press", "Deadlift"...). Seul le contenu autour (description, instructions, tips, erreurs, UI, filtres) est en français |
| Hébergement vidéo | **CDN distant SmartWorkout en priorité** (`video_dark_url`/`video_light_url`), avec un mécanisme de repli sur fichier local interchangeable plus tard sans changement de code, si un hébergement local est souhaité dans le futur |
| Exercices "cardio résiduels" (29 exercices `bp:"cardio"` actuels sans équivalent SmartWorkout) | Vérifié précisément : seuls 3/29 (burpee, jump rope, mountain climber) ont un équivalent SmartWorkout taggé CARDIO. **Les 26 autres sont conservés** comme 10ᵉ catégorie de corps (`CARDIO`), avec traduction FR de leur contenu à faire (volume négligeable) |
| Schéma de données | **Approche A** : adopter tel quel le schéma SmartWorkout / Anatomy Viewer (`name`, `body_part`, `equipments`, `exercise_muscles`, `instructions`, `tips`, `common_mistakes`, `tags`, `mechanics`, `laterality`, `weight_type`, vidéo), avec des **alias de compatibilité** `n` (= name) et `bp` (= body_part) sur chaque fiche pour ne pas casser les ~49 sites d'affichage existants dans l'app |

## Portée

**Dans le périmètre :**
- Nouveau catalogue d'exercices (811 SmartWorkout + 26 résiduels traduits = 837 exercices)
- Résolution vidéo (CDN distant, repli local interchangeable)
- Nouvelle fiche détail exercice (description, instructions, tips, erreurs, muscles activés en %)
- Filtres remaniés dans `Library.jsx` (recherche, partie du corps, équipement, mécanique, latéralité, muscle + seuil d'activation)
- Régénération du template Excel et vérification de l'import Excel/CSV
- Exercices personnalisés : compatibilité avec le nouveau schéma
- Mode démo (`demoSeed.js`), logique de progression (`progression.js`), onboarding équipement (`Onboarding.jsx`), mapping muscles (`muscles.js`), importeur CSV legacy (`import-csv.js`)

**Hors périmètre (chantier futur) :**
- Intégration de la vue anatomique 3D (corps 3D, muscles cliquables, double face avant/arrière)
- Traduction des noms d'exercices en français
- Traduction du contenu vers les 9 langues autres que FR/EN
- Auto-hébergement des vidéos (le mécanisme est prévu mais pas activé)
- Migration de données utilisateur existantes (non applicable, coupure nette actée)

## Architecture des données

### Nouveau fichier catalogue

`frontend/src/lib/exercises-data.js` est remplacé par un catalogue de 837 fiches, généré
(pas écrit à la main) par un nouveau script `scripts/build-exercises-data.js` qui :

1. Lit `exercises-flat.json` d'Anatomy Viewer (811 exercices SmartWorkout, déjà enrichi FR)
2. Lit un fichier séparé des 26 exercices "cardio résiduels" (portés depuis l'actuel
   `exercises-data.js`, reformatés au nouveau schéma, avec traduction FR de leurs
   instructions ajoutée via le même mécanisme que les scripts `translate-fr-*.js`
   existants dans Anatomy Viewer)
3. Fusionne les deux listes, ajoute les alias `n`/`bp` sur chaque fiche, assigne un `id`
   stable à chaque résiduel (les 811 SmartWorkout gardent leur UUID d'origine)
4. Émet le fichier final `exercises-data.js` importé par le reste de l'app

Ce script est ré-exécutable : si Anatomy Viewer met à jour son catalogue plus tard (nouvelle
vidéo, correction de traduction), on peut regénérer le catalogue OpenGym sans travail manuel.

### Forme d'une fiche exercice (schéma unifié)

```js
{
  // Champs natifs SmartWorkout (ou équivalent pour les résiduels)
  id: "uuid-ou-id-residuel",
  name: "Bench Press",                 // anglais, jamais traduit
  body_part: "CHEST",                  // ABS|BACK|BICEPS|CHEST|FOREARMS|GLUTEUS|LEGS|SHOULDERS|TRICEPS|CARDIO
  equipments: ["BARBELL", "BENCH"],    // tableau, peut être vide (poids du corps)
  laterality: "BILATERAL",
  mechanics: "COMPOUND",
  weight_type: "BARBELL",
  tags: ["STRENGTH", "PUSH"],
  exercise_muscles: { CHEST_MIDDLE: 100, TRICEPS_LATERAL_HEAD: 70, ... },
  description: "...", description_fr: "...",
  instructions: { en: [...], fr: [...] },
  tips: { en: [...], fr: [...] },
  common_mistakes: { en: [...], fr: [...] },   // absent/vide pour les résiduels si non traduit
  video_dark_url: "https://api.smartworkout.app/...", // absent pour les résiduels
  video_light_url: "https://api.smartworkout.app/...",
  local_video: "/Videos/Bench Press.mp4",       // absent pour les résiduels
  image_url: "https://...",                      // absent pour les résiduels
  gif: "0001-2gPfomN.gif",                       // présent UNIQUEMENT pour les résiduels
  img: "0001-2gPfomN.jpg",                       // présent UNIQUEMENT pour les résiduels

  // Alias de compatibilité — lus par les ~49 sites d'affichage existants
  n: "Bench Press",       // = name
  bp: "CHEST",             // = body_part (ou "CARDIO" pour les résiduels)
}
```

### `frontend/src/lib/exercises.js` — changements

- **Retiré** : `_sw`, `loadSwEnrichment()`, `swDataFor()`, `swVideoSrc()` (l'enrichissement
  partiel async n'a plus lieu d'être, la donnée est désormais native à 99%)
- **Ajouté** :
  - `videoSrc(ex)` → `ex.video_dark_url || ex.video_light_url || localFallback(ex)`, où
    `localFallback` construit un chemin `/videos/<name>.mp4` vérifiable côté
    `frontend/public/videos/` (vide pour l'instant, prêt à recevoir des fichiers si
    l'auto-hébergement est activé plus tard)
  - `musclesOf(ex)` / `sortedMuscles(ex)` (portés d'Anatomy Viewer) pour la fiche détail et
    le filtre par muscle
- **Modifié** :
  - `equipmentOf(list)` : passe d'un comptage sur une string unique (`e.eq`) à un comptage
    sur un tableau (`e.equipments`), un exercice pouvant apparaître dans plusieurs
    compteurs d'équipement
  - `isBodyweightEq(idOrEx)` : `equipments.length === 0` au lieu de `eq === 'body weight'`
  - `isCardio(idOrEx)` : `bp === 'CARDIO'` (fonctionne via l'alias, aucun site appelant à
    modifier)
  - `BODYPARTS` : dérivé de `bp` comme avant, contient désormais les 10 catégories

### `frontend/src/lib/displayEnum.js` (nouveau, porté d'Anatomy Viewer)

Table de traduction FR pour les valeurs d'enum (`ABS` → "Abdominaux", `PULL_UP_BAR` → "Barre
de traction", `COMPOUND` → "Polyarticulaire", etc.), utilisée par les filtres, la fiche
détail et le template Excel. **Doit couvrir exhaustivement** toutes les valeurs présentes
dans les 837 fiches — un audit de complétude fait partie du plan de test (voir plus bas),
pour éviter qu'une valeur d'enum brute (ex. "PULL_UP_BAR") s'affiche dans l'UI française.

## Vidéos

`videoSrc(ex)` remplace `swVideoSrc(id)`. Priorité : URL distante SmartWorkout → fichier
local optionnel. Le proxy Vite `/sw-video` et la variable `.env` `SW_VIDEOS_PATH` /
`SW_VIDEO_TARGET` restent en place mais deviennent **optionnels/legacy** : plus nécessaires
pour le fonctionnement par défaut, gardés pour un usage futur d'auto-hébergement.

`components/Media.jsx` branche sur trois cas :
1. `videoSrc(ex)` renvoie une URL → lecteur vidéo (autoplay/loop/muted, comme Anatomy Viewer)
2. Sinon, `ex.gif`/`ex.img` présents (résiduels uniquement) → comportement GIF/image actuel
3. Sinon, `ex.image_url` (SmartWorkout sans vidéo) → image statique
4. Sinon → aucun média (état "pas de vidéo disponible")

Le service média local (port 8888, `media/gif` + `media/img`) ne sert plus que les fichiers
des 26 résiduels — son rôle devient marginal. Le téléchargement Docker du dataset complet
(~140 Mo) pourrait être réduit aux 26 fichiers nécessaires ; **optimisation non bloquante,
reportée**.

## Filtres (`views/Library.jsx`)

Filtres remaniés sur le modèle d'Anatomy Viewer, adaptés à l'UX mobile-first d'OpenGym
(pas la mise en page 3 colonnes desktop) :
- Recherche texte (nom)
- Partie du corps (`body_part`, 10 valeurs, libellés FR via `displayEnum`)
- Équipement (`equipments`, test d'appartenance dans le tableau + option "Poids du corps
  uniquement" quand le tableau est vide)
- Mécanique (`mechanics` : isolé/composé)
- Latéralité (`laterality`)
- Muscle précis + seuil d'activation minimum (0/10/25/50/75%), sur `exercise_muscles`

La logique de `matchesFilters` d'Anatomy Viewer est reprise et adaptée aux nouveaux champs ;
les options de chaque filtre sont dérivées dynamiquement de la liste déjà filtrée (comme le
fait déjà `equipmentOf` aujourd'hui), pas figées en dur.

## Fiche détail exercice

Ajout dans `sheets.jsx` (ou nouveau composant dédié si la sheet existante devient trop
grosse) des sections suivantes, sur le modèle du `DetailPanel` d'Anatomy Viewer, adaptées au
format bottom-sheet mobile d'OpenGym :
- Vidéo (via `videoSrc`)
- Infos rapides : partie du corps, mécanique, type de poids, équipement, latéralité
  (libellés FR)
- Muscles activés, barres triées par intensité
- Description (`extractDesc`)
- Instructions, tips, erreurs fréquentes (`extractLang`, repli EN si FR absent)

## Import/Export Excel et CSV

- `excelTemplate.js` : `BODY_PARTS` régénéré sur les 10 nouvelles catégories, libellés FR
  dans le menu déroulant (via `displayEnum`), noms d'exercices affichés en anglais. Le
  mécanisme de named ranges / listes en cascade (`Lists` caché, `INDIRECT(SUBSTITUTE(...))`)
  reste structurellement identique.
- `programImport.js` : `findExercise()` (matching flou par nom) **ne change pas** — il est
  agnostique du dataset sous-jacent. Un ancien fichier Excel généré avant le swap ne
  matchera plus grand-chose contre le nouveau catalogue (attendu, coupure nette assumée,
  aucune garantie de compatibilité ascendante des anciens fichiers exportés).
- `import-csv.js` : importeur CSV legacy séparé, à auditer et adapter aux nouveaux champs
  s'il référence `bp`/`eq` de façon incompatible avec le nouveau tableau `equipments`.

## Exercices personnalisés

`CustomExForm` (`sheets.jsx:521`) n'a **pas besoin de changement structurel** : il continue
de produire `{ id, n, bp, desc, tg:'', eq:'custom', custom:true }`. Le sélecteur de partie du
corps se nourrit de `BODYPARTS`, qui reflète automatiquement les nouvelles catégories. Une
vérification manuelle suffit (créer un exercice personnalisé avec `bp: "CARDIO"` par
exemple, et confirmer qu'il s'affiche et se logue normalement).

## Autres fichiers à auditer/adapter

| Fichier | Action |
|---|---|
| `views/Onboarding.jsx` | Sélecteur d'équipement possédé — référence `'body weight'` en dur, à adapter aux nouvelles valeurs `equipments` |
| `lib/demoSeed.js` | Données du mode DÉMO (routines/historique fictifs) référencent l'ancien catalogue par nom/id — à régénérer contre le nouveau catalogue |
| `lib/muscles.js` | Mapping de muscles à adapter aux clés `exercise_muscles` (plus fines que l'ancien `sm`/`mg`) |
| `lib/progression.js` (+ `progression.test.js`) | Règles de progression variant par partie du corps — à revérifier avec précaution, tests existants à garder verts |
| `frontend/src/instr/*.js` | **Retiré** — les instructions traduites vivent désormais inline dans chaque fiche (FR déjà présent pour les 811 SmartWorkout, ajouté pour les 26 résiduels) |

**Non concernés** (faux positifs identifiés lors de l'audit) : `components/BodyMeasureMap.jsx`
et `lib/measurements.js` référencent "chest"/"waist" au sens tour de poitrine/taille
(mensurations corporelles), sans lien avec le catalogue d'exercices.

## Plan de vérification (swap sans accroc)

1. **Intégrité des données** : script de validation confirmant que les 837 fiches ont tous
   les champs minimaux requis (`id`, `n`, `bp`) — aucun risque de "Unknown exercise"
   inattendu via `exOr()`
2. **Complétude des traductions d'enum** : lister toutes les valeurs distinctes de
   `body_part`/`equipments`/`mechanics`/`laterality`/`weight_type` présentes dans le
   catalogue final et vérifier qu'`displayEnum.js` a une entrée FR pour chacune — sinon une
   valeur brute type "PULL_UP_BAR" s'afficherait dans l'UI française
3. **Aller-retour Excel** : générer le template, remplir une petite programme d'exemple,
   l'importer, vérifier que les exercices sont correctement retrouvés
4. **Création/édition d'exercice personnalisé** avec une valeur `bp` du nouveau schéma
   (y compris `"CARDIO"`)
5. **Historique/progression/PR** : logguer une séance avec un exercice du nouveau catalogue,
   vérifier que le calcul de PR et les vues Stats affichent correctement le nom/la partie du
   corps (validant les alias)
6. **Rendu média** : vérifier un exercice avec vidéo CDN, un exercice SmartWorkout sans
   vidéo (image statique), et un résiduel avec GIF — dans `Media.jsx` et la fiche détail
7. **Filtres** : vérifier chaque filtre individuellement puis en combinaison (ET logique),
   et que les options proposées sont bien dérivées dynamiquement du nouveau catalogue
8. **Mode démo** : lancer l'app en mode DÉMO, vérifier que les données pré-remplies
   s'affichent sans exercice orphelin
9. **Tests unitaires existants** : `npm test` (dans `frontend/`) doit rester vert,
   particulièrement `progression.test.js`, `programImport.test.js`, `history.test.js`

## Risques connus (acceptés, à garder en tête)

- **Dépendance à un service tiers** : les vidéos par défaut viennent de
  `api.smartworkout.app`, un service commercial non garanti dans le temps. Le mécanisme de
  repli local existe mais n'est pas activé par défaut.
- **Zone grise de droits** : les données SmartWorkout (description, tips, vidéos) proviennent
  d'un scraping d'un site commercial, contrairement à l'ancien dataset sous licence CC
  ouverte. Décision assumée par le porteur du projet, pas de blocage technique associé.
- **Réduction du volume total** : 837 exercices contre 1324 aujourd'hui (-37%), avec une
  taxonomie de partie du corps différente (pas de "neck" par exemple).
