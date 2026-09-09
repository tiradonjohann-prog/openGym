# OpenGym Mobile — APK Android + PWA iOS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre OpenGym installable sur Android (APK) et iOS (PWA Safari) avec persistance locale fiable et zéro infrastructure serveur.

**Architecture:** Build statique Vite déployé sur Vercel (PWA iOS). APK Android via le script `build:mobile` existant + Android Studio. Données 100% locales (localStorage + Capacitor Filesystem). Export/Import JSON déjà implémenté dans Settings.jsx — aucun nouveau code de stockage nécessaire.

**Tech Stack:** React 19 + Vite, Capacitor 7, Zustand, Vercel (gratuit), Android Studio

**Spec:** `docs/superpowers/specs/2026-09-09-static-pwa-mobile-design.md`

## Global Constraints

- Branche cible : `feature/static-pwa` (créée depuis `feature/smartworkout-integration`)
- `feature/smartworkout-integration` reste intacte — ne pas la modifier
- Zéro coût d'infrastructure (Vercel free, pas de backend)
- Zéro auth — guest mode automatique sur le build statique
- `VITE_MOBILE=1` réservé au build Android APK (Capacitor Filesystem)
- `VITE_STATIC=1` pour le build Vercel/PWA (localStorage uniquement)
- Variables d'env via fichiers `.env.<mode>` Vite — pas de `cross-env` (non installé)
- Le dossier `api/` n'est pas déployé sur Vercel mais reste dans le repo

---

## Fichiers modifiés ou créés

| Fichier | Action | Rôle |
|---------|--------|------|
| `frontend/.env.static` | Créer | Variables build Vercel (VITE_STATIC + CDN URLs) |
| `frontend/package.json` | Modifier | Ajouter script `build:static` |
| `vercel.json` | Créer | Config déploiement Vercel + SPA rewrites |
| `frontend/src/lib/mobile.js` | Modifier | Ajouter export `STATIC` |
| `frontend/src/store/useStore.js` | Modifier | Boot path pour mode statique |
| `frontend/src/locales/fr.js` | Modifier (Python) | Traductions manquantes export/import |

---

## Task 1 — Branche git + configuration build statique

**Files:**
- Create: `frontend/.env.static`
- Modify: `frontend/package.json` (script `build:static`)
- Create: `vercel.json` (racine du repo)

**Interfaces:**
- Produit: script `npm run build:static` fonctionnel + `vercel.json` prêt au déploiement

- [ ] **Étape 1 : Créer la branche**

```bash
git checkout -b feature/static-pwa
```

Vérifier : `git branch` doit afficher `* feature/static-pwa`.

- [ ] **Étape 2 : Créer `frontend/.env.static`**

Ce fichier est lu automatiquement par Vite quand on passe `--mode static`.

```
VITE_STATIC=1
VITE_IMG_BASE=https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@7455efae41b330c265e7cd4b78dfa848e7ce5ebd/images/
VITE_GIF_BASE=https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@7455efae41b330c265e7cd4b78dfa848e7ce5ebd/videos/
```

- [ ] **Étape 3 : Ajouter `build:static` dans `frontend/package.json`**

Ouvrir `frontend/package.json`. Dans la section `"scripts"`, ajouter après `"build"` :

```json
"build:static": "vite build --mode static",
```

La section scripts doit ressembler à :
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "build:static": "vite build --mode static",
  "build:mobile": "VITE_MOBILE=1 VITE_IMG_BASE=... VITE_GIF_BASE=... vite build && cap sync",
  ...
}
```

- [ ] **Étape 4 : Créer `vercel.json` à la racine du repo**

```json
{
  "buildCommand": "cd frontend && npm run build:static",
  "outputDirectory": "frontend/dist",
  "framework": null,
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Le champ `rewrites` est indispensable pour que React Router fonctionne (toutes les URLs renvoient vers `index.html`).

- [ ] **Étape 5 : Vérifier que le build fonctionne**

```bash
cd frontend
npm run build:static
```

Résultat attendu : build sans erreur, dossier `frontend/dist/` mis à jour. Vérifier que `dist/index.html` existe.

- [ ] **Étape 6 : Commit**

```bash
git add frontend/.env.static frontend/package.json vercel.json
git commit -m "feat: configuration build statique Vercel + mode Vite static"
```

---

## Task 2 — Mode invité automatique pour builds statiques

**Files:**
- Modify: `frontend/src/lib/mobile.js` ligne 14 → ajouter ligne 15
- Modify: `frontend/src/store/useStore.js` ligne 184 → import + boot path

**Interfaces:**
- Consomme: `STATIC = import.meta.env.VITE_STATIC === '1'` depuis `mobile.js`
- Produit: quand `VITE_STATIC=1`, l'app démarre en guest mode sans passer par Login.jsx

**Contexte :** Dans `App.jsx`, la décision d'afficher Login vs l'app repose sur `authed = user || isGuest()`. Si `isGuest()` renvoie `true` (= `localStorage.getItem('gym_guest') === '1'`), Login est bypassé. La fonction `setGuest(true)` écrit cette clé. Elle est déjà appelée dans le boot MOBILE (ligne 192 de useStore.js) et DEMO (ligne 203). On ajoute un boot path identique pour STATIC.

- [ ] **Étape 1 : Ajouter `STATIC` dans `mobile.js`**

Ouvrir `frontend/src/lib/mobile.js`. La ligne 14 est :
```js
export const MOBILE = import.meta.env.VITE_MOBILE === '1'
```

Ajouter immédiatement après (ligne 15) :
```js
export const STATIC = import.meta.env.VITE_STATIC === '1'
```

- [ ] **Étape 2 : Importer `STATIC` dans `useStore.js`**

Ouvrir `frontend/src/store/useStore.js`. Trouver la ligne qui importe depuis `mobile.js` (elle ressemble à) :
```js
import { MOBILE, nativeLoad, nativeSave, syncReminder } from '../lib/mobile.js'
```

Ajouter `STATIC` à cet import :
```js
import { MOBILE, STATIC, nativeLoad, nativeSave, syncReminder } from '../lib/mobile.js'
```

- [ ] **Étape 3 : Ajouter le boot path STATIC dans `useStore.js`**

Dans la fonction `boot()` (ligne 181), le bloc MOBILE se termine à la ligne 196 avec `return`. Ajouter le bloc STATIC **immédiatement après** le `return` du bloc MOBILE, avant le bloc `if (DEMO)` :

```js
// Static build (Vercel/PWA): no backend, data lives in localStorage, guest mode always.
if (STATIC) {
  get().setGuest(true)
  set({ ready: true })
  return
}
```

Le résultat doit ressembler à :
```js
async boot() {
  if (MOBILE) {
    // ... (code existant inchangé)
    set({ ready: true })
    return
  }
  // Static build (Vercel/PWA): no backend, data lives in localStorage, guest mode always.
  if (STATIC) {
    get().setGuest(true)
    set({ ready: true })
    return
  }
  // Demo build (GitHub Pages): no backend at all — seed once, stay in guest mode.
  if (DEMO) {
    // ... (code existant inchangé)
  }
  // ... (reste inchangé)
}
```

- [ ] **Étape 4 : Vérifier le build statique**

```bash
cd frontend
npm run build:static
npx vite preview --mode static
```

Ouvrir http://localhost:4173 dans le navigateur. L'app doit démarrer directement sur l'écran d'onboarding (ou accueil si des données existent en localStorage), **sans afficher Login.jsx**.

Si Login.jsx s'affiche → `STATIC` n'est pas correctement lu. Vérifier que `.env.static` est bien dans `frontend/` et que le script `build:static` utilise `--mode static`.

- [ ] **Étape 5 : Commit**

```bash
git add frontend/src/lib/mobile.js frontend/src/store/useStore.js
git commit -m "feat: mode invité automatique pour builds statiques (VITE_STATIC)"
```

---

## Task 3 — Vérifier et compléter les traductions françaises

**Files:**
- Modify: `frontend/src/locales/fr.js` (via Python — encodage spécial UTF-8 double BOM CRLF)

**Contexte :** `fr.js` utilise un encodage particulier (UTF-8 double BOM + CRLF) et des guillemets courbes. Toute modification doit passer par un script Python en mode binaire. L'export/import dans Settings.jsx utilise plusieurs strings traduits via `t()` — certains peuvent manquer.

**Strings à vérifier** (clés telles qu'elles apparaissent dans le code) :
- `"Backup exported"` (doExport, toast)
- `"Backup imported"` (doImport, toast)
- `"Import backup?"` (doImport, titre confirmation)
- `"This replaces all current data with the backup file."` (doImport, message)
- `"Import failed: {0}"` (doImport, toast erreur)
- `"Import backup"` (Settings row title)
- `"Export backup (JSON)"` (Settings row title)

- [ ] **Étape 1 : Vérifier les traductions existantes**

Exécuter ce script Python depuis la racine du projet :

```python
import re

with open('frontend/src/locales/fr.js', 'rb') as f:
    content = f.read().decode('utf-8-sig')

keys_to_check = [
    "Backup exported",
    "Backup imported",
    "Import backup?",
    "This replaces all current data with the backup file.",
    "Import failed: {0}",
    "Import backup",
    "Export backup (JSON)",
]

for key in keys_to_check:
    found = f"'{key}'" in content or f'"{key}"' in content
    print(f"{'✅' if found else '❌'} {key}")
```

- [ ] **Étape 2 : Ajouter les traductions manquantes**

Pour chaque clé absente identifiée à l'étape 1, créer un script Python qui insère les entrées avant la dernière ligne `}` de `fr.js`. Exemple pour les 7 clés si toutes manquent :

```python
import re

with open('frontend/src/locales/fr.js', 'rb') as f:
    raw = f.read()

# Repérer la dernière occurrence de "}\r\n" ou "}\n" pour insérer avant
new_entries = (
    "  'Backup exported': 'Sauvegarde exportée',\r\n"
    "  'Backup imported': 'Sauvegarde importée',\r\n"
    "  'Import backup?': 'Importer la sauvegarde ?',\r\n"
    "  'This replaces all current data with the backup file.': 'Remplace toutes les données actuelles par le fichier de sauvegarde.',\r\n"
    "  'Import failed: {0}': 'Importation échouée : {0}',\r\n"
    "  'Import backup': 'Importer une sauvegarde',\r\n"
    "  'Export backup (JSON)': 'Exporter la sauvegarde (JSON)',\r\n"
).encode('utf-8')

# Trouver la position de la dernière accolade fermante
last_brace = raw.rfind(b'}')
raw = raw[:last_brace] + new_entries + raw[last_brace:]

with open('frontend/src/locales/fr.js', 'wb') as f:
    f.write(raw)

print("Traductions ajoutées.")
```

N'ajouter que les clés réellement absentes (identifiées à l'étape 1).

- [ ] **Étape 3 : Vérifier le build après modification**

```bash
cd frontend && npm run build:static
```

Aucune erreur de syntaxe ne doit apparaître.

- [ ] **Étape 4 : Commit si des traductions ont été ajoutées**

```bash
git add frontend/src/locales/fr.js
git commit -m "feat: traductions françaises export/import sauvegarde"
```

Si aucune traduction ne manquait, passer cette étape.

---

## Task 4 — Déploiement Vercel (PWA iOS)

**Files:**
- Aucun fichier supplémentaire — `vercel.json` créé en Task 1 suffit

**Interfaces:**
- Consomme: `vercel.json` + branche `feature/static-pwa`
- Produit: URL HTTPS publique (ex. `https://opengym-xxx.vercel.app`) utilisable comme PWA sur iOS

**Prérequis :** Compte Vercel gratuit (vercel.com) + repo git accessible (GitHub, GitLab, ou Bitbucket). Si le repo n'est pas encore en ligne, pousser d'abord :

```bash
git remote add origin <URL_DU_REPO>
git push -u origin feature/static-pwa
```

- [ ] **Étape 1 : Créer le projet sur Vercel**

1. Aller sur [vercel.com/new](https://vercel.com/new)
2. Importer le repo git
3. Vercel détecte automatiquement `vercel.json` → les paramètres Build Command et Output Directory sont pré-remplis
4. Vérifier : Build Command = `cd frontend && npm run build:static`, Output Directory = `frontend/dist`
5. Cliquer **Deploy**

- [ ] **Étape 2 : Vérifier le déploiement**

Une fois le déploiement terminé :
1. Ouvrir l'URL Vercel dans un navigateur desktop
2. L'app doit charger et aller directement à l'onboarding (pas Login)
3. Vérifier dans DevTools → Application → Manifest : les champs `name`, `display: standalone`, `icons` doivent être présents
4. Vérifier que les images d'exercices chargent (elles viennent du CDN jsDelivr)

- [ ] **Étape 3 : Tester l'installation PWA sur iPhone**

Sur l'iPhone :
1. Ouvrir l'URL Vercel dans **Safari** (pas Chrome — Chrome iOS ne supporte pas l'installation PWA)
2. Appuyer sur le bouton Partager (carré avec flèche vers le haut)
3. Sélectionner **"Sur l'écran d'accueil"**
4. Confirmer le nom → Ajouter
5. Ouvrir depuis l'écran d'accueil → doit démarrer en plein écran sans barre Safari

- [ ] **Étape 4 : Tester la persistance sur iOS**

1. Compléter l'onboarding (prénom, objectif, etc.)
2. Fermer complètement l'app (swipe up)
3. Rouvrir depuis l'écran d'accueil
4. Les données doivent être présentes (accueil avec le prénom)

- [ ] **Étape 5 : Tester l'export sauvegarde sur iOS**

1. Aller dans Réglages → section Data
2. Appuyer "Export backup (JSON)"
3. Le navigateur doit proposer de télécharger ou partager le fichier `.json`
4. Vérifier que le fichier contient les données (workouts, routines, nutrition, etc.)

- [ ] **Étape 6 : Commit + tag**

```bash
git add .
git commit -m "chore: déploiement Vercel PWA iOS validé"
git tag v-static-pwa-ios
```

---

## Task 5 — Build APK Android

**Files:**
- Aucun fichier source modifié — utilise `build:mobile` existant et le projet Android existant `frontend/android/`

**Interfaces:**
- Consomme: `frontend/android/` (projet Gradle existant), script `build:mobile`
- Produit: `frontend/android/app/build/outputs/apk/release/app-release.apk`

**Prérequis :** Android Studio installé (téléchargeable sur developer.android.com/studio).

- [ ] **Étape 1 : Builder le bundle web pour Android**

```bash
cd frontend
npm run build:mobile
```

Ce script fait : `VITE_MOBILE=1 + CDN URLs → vite build → cap sync` (sync vers iOS ET Android). Le dossier `frontend/android/app/src/main/assets/public/` sera mis à jour avec le nouveau build.

Si le script échoue sur Windows (syntaxe Unix), lancer depuis Git Bash ou WSL :
```bash
VITE_MOBILE=1 \
  VITE_IMG_BASE=https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@7455efae41b330c265e7cd4b78dfa848e7ce5ebd/images/ \
  VITE_GIF_BASE=https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@7455efae41b330c265e7cd4b78dfa848e7ce5ebd/videos/ \
  vite build && npx cap sync android
```

- [ ] **Étape 2 : Générer le keystore de signature (une seule fois)**

Le keystore est le certificat qui signe l'APK. **À conserver précieusement** — sa perte empêche les mises à jour sans désinstallation.

```bash
keytool -genkeypair \
  -v \
  -storetype PKCS12 \
  -keystore opengym-release.keystore \
  -alias opengym \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Répondre aux questions (nom, organisation, pays). Choisir un mot de passe fort. Stocker `opengym-release.keystore` dans un endroit sûr (pas dans le repo git).

Ajouter au `.gitignore` si ce n'est pas déjà fait :
```
*.keystore
*.jks
```

- [ ] **Étape 3 : Ouvrir le projet Android dans Android Studio**

1. Lancer Android Studio
2. File → Open → naviguer vers `C:\Users\Johann\openGym\frontend\android`
3. Attendre la synchronisation Gradle (peut prendre quelques minutes)
4. Si Gradle demande une mise à jour du plugin, accepter

- [ ] **Étape 4 : Générer l'APK signé**

1. Menu **Build** → **Generate Signed Bundle / APK**
2. Sélectionner **APK** (pas Bundle) → Next
3. Choisir le keystore créé à l'étape 2 :
   - Key store path : chemin vers `opengym-release.keystore`
   - Key store password : mot de passe choisi
   - Key alias : `opengym`
   - Key password : même mot de passe
4. Cliquer Next → choisir **release** → Finish
5. L'APK sera généré dans : `frontend/android/app/build/outputs/apk/release/app-release.apk`

- [ ] **Étape 5 : Installer l'APK sur Android**

**Option A — Via câble USB :**
```bash
adb install frontend/android/app/build/outputs/apk/release/app-release.apk
```

**Option B — Via fichier :**
1. Copier l'APK sur le téléphone (email, Drive, câble)
2. Sur Android → Paramètres → Sécurité → activer "Sources inconnues" (ou "Installer des applis inconnues" selon la version Android)
3. Ouvrir le fichier APK depuis le gestionnaire de fichiers → Installer

- [ ] **Étape 6 : Tester la persistance sur Android**

1. Ouvrir l'app OpenGym
2. Compléter l'onboarding
3. Enregistrer une séance d'entraînement complète
4. Forcer la fermeture de l'app (Paramètres → Apps → OpenGym → Forcer l'arrêt)
5. Rouvrir → les données doivent être présentes
6. Redémarrer le téléphone → rouvrir → données toujours présentes

- [ ] **Étape 7 : Tester l'export sauvegarde sur Android**

1. Réglages → Export backup (JSON)
2. La feuille de partage OS doit s'ouvrir (Drive, WhatsApp, email, etc.)
3. Envoyer le fichier quelque part → vérifier son contenu JSON

- [ ] **Étape 8 : Tester la mise à jour APK**

Simuler une mise à jour :
1. Avec des données déjà enregistrées, réinstaller le même APK par-dessus (`adb install -r app-release.apk` ou réinstaller via fichier)
2. Rouvrir l'app → toutes les données doivent être préservées
3. Ce comportement garantit que les vraies mises à jour futures préservent les données

- [ ] **Étape 9 : Commit final**

```bash
git commit -m "chore: build APK Android validé — persistance et mise à jour OK"
git tag v-static-pwa-android
git push origin feature/static-pwa --tags
```

---

## Tests de validation finale

Cocher après vérification réelle sur les appareils :

**iOS (PWA)**
- [ ] App installable depuis Safari → "Sur l'écran d'accueil"
- [ ] Démarre en plein écran sans barre Safari
- [ ] Onboarding complet puis données préservées après fermeture
- [ ] Séance enregistrée → fermer → rouvrir → séance présente dans historique
- [ ] Export JSON produit un fichier valide avec toutes les données
- [ ] Import JSON restaure un backup (tester avec un backup exporté)
- [ ] Mode avion → enregistrer séance → reconnexion → données présentes (local)

**Android (APK)**
- [ ] APK installable (sources inconnues activées)
- [ ] Onboarding complet puis données préservées après fermeture
- [ ] Séance enregistrée → fermer app → rouvrir → séance présente
- [ ] Redémarrage téléphone → données préservées
- [ ] Export JSON via share sheet OS fonctionne
- [ ] Import JSON restaure les données
- [ ] Réinstallation APK → données préservées
- [ ] Mode avion → enregistrer séance → données préservées

---

## Résumé des changements par rapport à la branche actuelle

| Ce qui change | Ce qui ne change pas |
|---------------|---------------------|
| `frontend/.env.static` (nouveau) | Tout le frontend React |
| `vercel.json` (nouveau) | Store Zustand |
| `build:static` dans package.json | Export/Import JSON (déjà implémenté) |
| `STATIC` flag dans mobile.js | Logique métier |
| Boot path STATIC dans useStore.js | Composants UI |
| Traductions manquantes dans fr.js | Build mobile Android (inchangé) |
