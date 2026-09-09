# OpenGym — Déploiement Mobile : APK Android + PWA iOS

**Date :** 2026-09-09
**Branche cible :** `feature/static-pwa` (créée depuis `feature/smartworkout-integration`)
**Branche actuelle préservée :** `feature/smartworkout-integration` (backend Node.js intact)

---

## Contexte

Transformer OpenGym en application utilisable quotidiennement sur un appareil Android et un appareil iOS, sans passer par les stores, sans coût d'infrastructure, et avec persistance fiable des données d'entraînement.

**Utilisateurs :** 2 personnes, chacune sur son propre appareil (pas de sync inter-appareils).
**Priorité absolue :** les données d'entraînement ne doivent jamais être perdues en usage normal.

---

## Architecture cible

```
Android (APK Capacitor)          iOS (PWA Safari)
       │                                │
       ├── Fichier natif local          ├── localStorage
       │   (Capacitor Filesystem)       │   (gym_state_v1)
       └── Export JSON manuel           └── Export JSON manuel
                    │                           │
                    └─────── Vercel ────────────┘
                          (hébergement statique gratuit)
                          Vidéos/Images : jsDelivr CDN
```

### Ce qui ne change pas

- Tout le frontend React (UI, composants, logique métier)
- Zustand store complet (`useStore.js`, `useUI.js`)
- Persistance locale (localStorage + Capacitor Filesystem — déjà implémentés)
- Offline-first : l'app fonctionne sans Internet, données sauvegardées en local
- Vidéos d'exercices : jsDelivr CDN (déjà utilisé dans `build:mobile`)
- Projets iOS/Android Capacitor existants (`frontend/ios/`, `frontend/android/`)
- Onboarding wizard (déjà en français, déjà adapté mobile)

### Ce qui change

| Fichier | Modification |
|---------|-------------|
| `frontend/package.json` | Nouveau script `build:static` |
| `frontend/vite.config.js` | Suppression des proxies backend |
| `frontend/src/views/Settings.jsx` | Export JSON complet + Import JSON |
| `frontend/capacitor.config.json` | `server.url` → URL Vercel (prod) |

### Ce qui est supprimé (nouvelle branche uniquement)

- Le dossier `api/` n'est pas déployé (reste sur l'ancienne branche)
- Les proxies Vite (`/api`, `/img`, `/gif`, `/sw-video`)
- La logique `pushState` / `pullState` vers le backend Node.js

---

## Données et persistance

### Stockage local

| Couche | Android (APK) | iOS (PWA) |
|--------|--------------|-----------|
| Principal | Capacitor Filesystem (`opengym-state.json`) | localStorage (`gym_state_v1`) |
| Fallback | localStorage | — |
| Préservé lors d'une mise à jour | ✅ Oui | ✅ Oui |
| Préservé lors d'une désinstallation | ❌ Non | ❌ Non |

### Données couvertes par l'export

L'intégralité de `gym_state_v1` :
- Profil utilisateur (nom, unité, objectif, niveau, sport, nutrition)
- Routines d'entraînement et programmes
- Historique complet des séances (`workouts[]`)
- PRs par exercice (`exWeights{}`)
- Journal nutrition (`nutritionLog{}`)
- Poids corporel et mensurations (`bodyweight[]`, `measurements[]`)
- Exercices personnalisés (`customEx[]`)
- Préférences et réglages

### Backup : Export / Import JSON

**Export :**
1. Bouton "Sauvegarder mes données" dans Réglages
2. Génère `opengym-backup-YYYY-MM-DD.json` (état complet)
3. Android : partage via `@capacitor/share` (Drive, WhatsApp, email…)
4. iOS : téléchargement natif via `<a download>`
5. L'utilisateur stocke le fichier où il veut (iCloud, Google Drive, email)

**Import / Restauration :**
1. Bouton "Restaurer depuis une sauvegarde" dans Réglages
2. Sélection du fichier JSON
3. Validation du format avant import (vérification des clés critiques)
4. Fusion avec les defaults (`deepMerge(DEF, imported)`) pour compatibilité future
5. Redémarrage de l'état → l'app recharge

**Fréquence recommandée :** un rappel dans l'app si aucun export depuis 14 jours (optionnel, phase 2).

---

## Vidéos et images

Deux builds distincts, mêmes URLs CDN :

- `build:static` → Vercel/PWA (pas de `VITE_MOBILE`, persistance localStorage)
- `build:mobile` → Android APK (`VITE_MOBILE=1`, persistance Capacitor Filesystem)



```
VITE_IMG_BASE=https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@.../images/
VITE_GIF_BASE=https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@.../videos/
```

Comportement offline : les vidéos ne chargent pas (réseau requis). Les données d'entraînement fonctionnent 100% offline.

---

## Authentification

**Aucune authentification.** L'app démarre directement en mode invité (`gym_guest = true` par défaut dans le build statique). Pas d'écran de connexion, pas de compte.

L'écran de connexion actuel (`Login.jsx`) est bypassé : l'app atterrit directement sur l'onboarding (si premier lancement) ou sur l'accueil (si données existantes).

---

## Hébergement : Vercel

- Build statique déployé sur Vercel (gratuit, 100 GB/mois)
- URL HTTPS automatique (requis pour PWA sur iOS)
- Déploiement automatique sur push vers `feature/static-pwa`
- URL finale utilisée dans `capacitor.config.json` pour le build APK

---

## Android — APK

**Build :**
```bash
cd frontend
npm run build:mobile   # VITE_MOBILE=1 + CDN URLs + cap sync (script existant)
```
Puis ouvrir Android Studio → Build → Generate Signed APK.

> `build:mobile` est distinct de `build:static` (Vercel) : il active `VITE_MOBILE=1` qui déclenche la persistance via Capacitor Filesystem au lieu du seul localStorage.

**Distribution :** fichier APK envoyé directement (email, WhatsApp, Drive).
**Installation :** activer "Sources inconnues" sur Android → installer le `.apk`.
**Mises à jour :** envoyer le nouvel APK, réinstaller. Données préservées (sandbox non effacé).

**Signature :** keystore généré une fois, conservé précieusement (perte = impossible de mettre à jour sans désinstaller).

---

## iOS — PWA

**Installation :**
1. Ouvrir l'URL Vercel dans Safari
2. Bouton Partager → "Sur l'écran d'accueil"
3. L'app s'ouvre en mode standalone (plein écran, sans barre Safari)

**Mises à jour :** automatiques — Safari recharge le nouveau build depuis Vercel à la prochaine ouverture.

**Limite connue :** iOS peut vider le localStorage PWA si le stockage est critique et l'app non ouverte depuis longtemps. Mitigation : export JSON régulier.

---

## Scénarios de perte de données

| Scénario | Android APK | iOS PWA | Mitigation |
|----------|------------|---------|-----------|
| Fermeture app | ✅ Données préservées | ✅ Données préservées | — |
| Redémarrage téléphone | ✅ | ✅ | — |
| Mise à jour app | ✅ | ✅ | — |
| Désinstallation | ❌ Perdu | ❌ Perdu | Export JSON avant désinstall |
| Perte/casse téléphone | ❌ Perdu | ❌ Perdu | Export JSON régulier |
| Stockage iOS bas | ✅ (fichier natif) | ⚠️ Risque localStorage | Export JSON régulier |
| Nouveau téléphone | ❌ Sans backup | ❌ Sans backup | Import JSON depuis backup |

---

## Plan d'implémentation

### Étape 1 — Branche et configuration build
- Créer `feature/static-pwa` depuis `feature/smartworkout-integration`
- Ajouter script `build:static` dans `package.json`
- Supprimer les proxies backend de `vite.config.js`
- Bypasser `Login.jsx` → démarrage direct en guest mode

### Étape 2 — Export / Import JSON (Settings.jsx)
- Bouton Export : sérialise `gym_state_v1`, partage via `@capacitor/share` ou `<a download>`
- Bouton Import : file picker, validation, `deepMerge`, reload store

### Étape 3 — Déploiement Vercel
- Connecter le repo à Vercel
- Configurer la commande de build et le répertoire de sortie
- Vérifier l'URL HTTPS générée

### Étape 4 — Build Android APK
- `npm run build:static && npx cap sync android`
- Générer le keystore (une seule fois)
- Build APK signé via Android Studio
- Tester l'installation et la persistance des données

### Étape 5 — Tests iOS PWA
- Ouvrir l'URL Vercel sur iPhone dans Safari
- Installer sur l'écran d'accueil
- Vérifier onboarding, séance, export JSON

### Étape 6 — Tests de persistance
- Créer une séance → fermer l'app → rouvrir → vérifier données
- Exporter JSON → désinstaller → réinstaller → importer → vérifier données
- Mettre à jour l'app → vérifier que les données sont préservées
- Tester offline : mode avion → enregistrer séance → reconnecter → vérifier

---

## Tests de validation

- [ ] Créer une séance complète sur Android → fermer → rouvrir → données présentes
- [ ] Créer une séance complète sur iOS PWA → fermer → rouvrir → données présentes
- [ ] Export JSON sur Android → fichier lisible, contient toutes les données
- [ ] Export JSON sur iOS → fichier lisible, contient toutes les données
- [ ] Import JSON → restaure profil, historique, nutrition
- [ ] Mise à jour APK → données préservées
- [ ] Mode avion → enregistrer séance → reconnexion → données présentes (local)
- [ ] Vidéos chargent en ligne, app fonctionnelle hors ligne

---

## Hors scope (version suivante)

- Service worker pour cache offline des vidéos
- Rappel automatique d'export si pas de backup depuis N jours
- Sync automatique Supabase (si besoin futur)
