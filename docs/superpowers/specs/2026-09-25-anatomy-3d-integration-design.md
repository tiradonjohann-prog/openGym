# OpenGym — Intégration de la visualisation anatomique 3D (MVP)

Date : 2026-09-25
Branche : `anatomy-3d-integration`

## Contexte

Le projet **Anatomy Viewer** (`../anatomy-viewer`, application React 19 + Three.js/React
Three Fiber séparée) dispose d'une visionneuse de corps humain 3D interactive : modèles
homme/femme, muscles individuellement sélectionnables/surlignables (`muscleHighlight.js`),
recherche, calques anatomiques, mode isolation.

Le swap d'exercices OpenGym vers les données SmartWorkout (`docs/superpowers/specs/2026-09-24-smartworkout-exercise-swap-design.md`)
avait explicitement mis de côté cette intégration comme "chantier futur". Ce document en
est la spec, pour une **première version (MVP)** : corps 3D, heatmap des muscles activés
depuis une fiche exercice, et clic sur un muscle pour retrouver les exercices qui le
ciblent.

Point clé découvert lors du brainstorming : Anatomy Viewer possède déjà un fichier
`sw-muscle-map.json` (44 entrées) qui mappe chaque clé de muscle SmartWorkout (`ABS_LOWER`,
`BACK_LATS`, etc.) vers le(s) nom(s) de mesh du modèle 3D. OpenGym utilise **exactement ce
même vocabulaire de 44 clés** depuis le swap SmartWorkout (`exercise_muscles` sur chaque
exercice, `MUSCLE_LABELS_FR` dans `exerciseLabels.js`) — ce fichier est donc réutilisable
tel quel, sans travail de correspondance supplémentaire.

## Décisions actées (issues du brainstorming)

| Sujet | Décision |
|---|---|
| Chargement | **Paresseux** (`React.lazy`) — Three.js/R3F/drei et les modèles `.glb` ne se chargent que si l'utilisateur ouvre la vue 3D. Zéro impact sur le chargement initial de l'app. |
| Périmètre | **MVP ciblé, extensible sans réécriture** : rotation/zoom libre, heatmap depuis une fiche exercice, clic muscle → liste d'exercices. Recherche, calques, isolation, guide de contrôles reportés en phase 2 — mais architecturés dès maintenant en réutilisant les vrais composants d'Anatomy Viewer (déjà bien séparés), pas une version simplifiée maison qu'il faudrait jeter plus tard. |
| Modèle 3D | **Homme/femme selon le sexe du profil OpenGym** (déjà connu, utilisé pour le schéma corporel 2D existant) — un seul modèle téléchargé par utilisateur. |
| Cible plateforme | **Web d'abord** (déploiement Vercel actuel) ; validation/adaptation mobile (Capacitor) dans un second temps. Un garde-fou WebGL simple est ajouté dès le MVP pour éviter un crash, peu coûteux et utile aux deux cibles. |
| Architecture technique | **Copie vendorisée** des fichiers nécessaires d'Anatomy Viewer dans OpenGym (composants, mapping muscles, modèles `.glb`) — même pattern que le vendoring des données SmartWorkout lors du swap précédent. Pas de package partagé/monorepo (restructuration trop lourde pour un projet qui n'évolue pas activement en parallèle). |

## Portée

**Dans le périmètre (MVP) :**
- Nouvelle vue `AnatomyView.jsx` avec corps 3D, rotation/zoom libre
- Chargement du modèle homme ou femme selon le profil utilisateur
- Depuis une fiche exercice : bouton "Voir en 3D" → heatmap des muscles activés (`exercise_muscles`)
- Depuis la vue 3D : clic sur un muscle → liste des exercices OpenGym qui le ciblent, triée par intensité d'activation
- Accès direct à la vue 3D sans exercice pré-sélectionné (exploration libre)
- Repli propre si WebGL indisponible

**Hors périmètre (phase 2, non traité ici) :**
- Recherche libre de muscles
- Calques anatomiques multiples, mode isolation
- Guide de contrôles interactif (`ControlsGuide.jsx`)
- Modèle de tête/visage (`AvatarHead.jsx`, `avatar-head.glb`)
- Validation et optimisation spécifique mobile/Capacitor
- Port de `exercises-by-muscle.json` (15,9 Mo) — la liste muscle→exercices est calculée à la volée depuis `EXDB`, pas besoin de ce fichier
- Port de `muscles-index.json` — dérivable localement si un compteur d'exercices par muscle est un jour nécessaire

## Architecture

### Nouveaux fichiers (dans `frontend/`)

| Fichier | Origine | Rôle |
|---|---|---|
| `src/components/anatomy3d/AnatomyModel.jsx` | Porté d'Anatomy Viewer | Charge et affiche le modèle `.glb` (homme ou femme) |
| `src/components/anatomy3d/CameraController.jsx` | Porté d'Anatomy Viewer | Contrôles de rotation/zoom (OrbitControls via drei) |
| `src/lib/muscleHighlight.js` | Porté d'Anatomy Viewer, tel quel | Colore/masque les meshes selon sélection/heatmap |
| `src/lib/muscle-mesh-map.json` | Copie de `sw-muscle-map.json` | Mapping clé muscle SmartWorkout ↔ nom(s) de mesh 3D |
| `src/lib/anatomy3d.js` | Nouveau | Fonctions pures : `meshesForMuscles(exerciseMuscles)`, `muscleKeyForMesh(meshName)`, `exercisesTargeting(muscleKey)` |
| `src/views/AnatomyView.jsx` | Nouveau | Vue plein écran : Canvas R3F, corps, heatmap, panneau liste d'exercices au clic |
| `public/models/male.glb`, `public/models/female.glb` | Copiés d'Anatomy Viewer | Modèles 3D (~7,7 Mo chacun) |

### Chargement paresseux

```jsx
// Dans le routeur (App.jsx ou équivalent)
const AnatomyView = lazy(() => import('./views/AnatomyView.jsx'))
```

Route `/anatomy`, avec un `<Suspense>` affichant un indicateur de chargement pendant le
téléchargement du chunk (Three.js + R3F + drei + modèle `.glb`, estimé à 10-15 Mo selon le
modèle chargé). Ce chunk est physiquement séparé du bundle principal par Vite du simple
fait de l'`import()` dynamique — aucune configuration supplémentaire nécessaire.

### `src/lib/anatomy3d.js` — contrat des fonctions

```js
// Traduit les muscles activés d'un exercice vers les meshes à surligner,
// avec leur intensité (0-100) pour la heatmap.
// Entrée : { CHEST_MIDDLE: 100, TRICEPS_LATERAL_HEAD: 70 }
// Sortie : [{ meshName: 'Pectoralis major muscle', value: 100 }, ...]
export function meshesForMuscles(exerciseMuscles) { ... }

// Retrouve la clé muscle SmartWorkout correspondant à un mesh cliqué.
// (mapping inverse construit une fois depuis muscle-mesh-map.json)
export function muscleKeyForMesh(meshName) { ... }

// Tous les exercices d'EXDB dont exercise_muscles contient cette clé,
// triés par valeur d'activation décroissante.
export function exercisesTargeting(muscleKey) { ... }
```

Un même mesh peut correspondre à plusieurs clés muscle (ex. `Rectus abdominis muscle` sert
à la fois `ABS_LOWER` et `ABS_UPPER`) — `muscleKeyForMesh` retourne dans ce cas la clé dont
l'exercice courant a l'activation la plus forte quand un contexte d'exercice est disponible,
sinon la première clé du mapping (comportement à documenter dans le code, pas une ambiguïté
produit critique pour le MVP).

### Flux de données

**Fiche exercice → heatmap 3D :**
1. `ExerciseDetail` (`sheets.jsx`) : bouton "Voir en 3D" à côté de la section muscles activés
2. `navigate('/anatomy', { state: { muscles: meshesForMuscles(ex.exercise_muscles) } })`
3. `AnatomyView` lit `location.state.muscles`, applique le surlignage via `muscleHighlight.js`
   (couleur/intensité proportionnelle à la valeur d'activation, pas juste on/off)

**Vue 3D → liste d'exercices :**
1. Clic sur un mesh (raycasting standard R3F, `onClick` sur chaque mesh du modèle)
2. `muscleKeyForMesh(mesh.name)` → clé muscle
3. `exercisesTargeting(muscleKey)` → liste triée
4. Affichage dans une bottom sheet (cohérent avec le pattern `openSheet` déjà utilisé partout
   dans OpenGym) — clic sur un exercice de la liste → `exerciseDetailSheet(ex)` habituel

**Accès direct :** un point d'entrée depuis le menu principal ou les paramètres vers
`/anatomy` sans état — le corps s'affiche neutre, l'exploration se fait uniquement par clic.

## Repli WebGL

Avant de monter le `<Canvas>` R3F, `AnatomyView` vérifie la disponibilité de WebGL :

```js
function hasWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch { return false }
}
```

Si `false`, affichage d'un message "Vue 3D non disponible sur cet appareil" avec un bouton
retour, au lieu de tenter le rendu et provoquer un écran blanc ou un crash. Protège aussi
bien d'anciens navigateurs web que la validation mobile à venir.

## Modèle homme/femme

`AnatomyView` lit le sexe du profil utilisateur depuis le store OpenGym existant (même
source que le schéma corporel 2D déjà en place) et charge `male.glb` ou `female.glb` en
conséquence. Si le profil n'a pas de sexe renseigné, repli sur `male.glb` par défaut (choix
arbitraire documenté, pas un enjeu produit pour le MVP).

## Dépendances ajoutées

`frontend/package.json` : `three`, `@react-three/fiber`, `@react-three/drei`.

**Volontairement exclues du MVP** : `@react-three/postprocessing` (effets visuels non
nécessaires), `three-mesh-bvh` (optimisation de raycasting pour des scènes complexes —
un seul modèle avec du raycasting standard R3F suffit à cette échelle).

## Plan de vérification

1. **Tests unitaires** (Vitest) sur `anatomy3d.js` : `meshesForMuscles` avec un exercice
   réel du catalogue (ex. Bench Press → muscles pectoraux/triceps attendus),
   `muscleKeyForMesh` sur un nom de mesh connu, `exercisesTargeting` retourne une liste
   non vide et correctement triée pour une clé muscle courante (ex. `CHEST_MIDDLE`)
2. **Build** : confirmer que le chunk Three.js/R3F/modèle est bien séparé du bundle
   principal (`vite build`, vérifier que `index-*.js` ne grossit pas)
3. **Manuel (web)** : rotation/zoom fluides, heatmap correcte pour 2-3 exercices différents,
   clic sur plusieurs muscles ouvre la bonne liste d'exercices à chaque fois, le modèle
   correspond au sexe du profil (tester avec un profil homme et un profil femme)
4. **Repli WebGL** : vérifier que le message de repli s'affiche proprement si on force
   l'absence de WebGL (ex. via les flags de désactivation du navigateur)

## Risques connus (acceptés, à garder en tête)

- **Poids de téléchargement à l'ouverture** : ~10-15 Mo au premier accès à la vue 3D
  (Three.js/R3F/drei + un modèle `.glb`). Acceptable pour du web avec chargement paresseux ;
  à réévaluer si la validation mobile (phase 2) révèle un problème sur connexion lente.
- **Mapping mesh↔muscle imparfait dans de rares cas** (un mesh servant plusieurs clés) —
  documenté ci-dessus, non bloquant pour le MVP.
- **Pas de test automatisé du rendu 3D lui-même** — WebGL n'est pas testable en
  Vitest/jsdom sans un mock lourd à faible valeur ajoutée ; la vérification manuelle
  (point 3 ci-dessus) couvre ce risque.
