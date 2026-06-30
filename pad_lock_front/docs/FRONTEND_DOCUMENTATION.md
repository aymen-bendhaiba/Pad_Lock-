# Documentation Frontend Pad Lock

## Objectif

Cette application frontend permet de superviser et gerer des cadenas connectes: tableau de bord, carte en direct, alarmes, geofences, rapports, configurations et commandes.

Le frontend ne contient pas la logique metier principale. Il affiche les donnees, envoie les actions utilisateur au backend et garde une interface claire pour l'operateur.

## Stack technique

- Next.js App Router pour les pages et le routage.
- React pour les composants interactifs.
- TypeScript pour securiser les types et reduire les erreurs.
- Tailwind CSS pour le style rapide et coherent.
- Leaflet et React Leaflet pour les cartes.
- Recharts pour les graphiques de rapports.
- Lucide React pour les icones.

## Demarrage local

```bash
npm install
npm run dev
```

Build et verification:x1

```bash
npm run build
npm run lint
npx tsc --noEmit
```

## Configuration environnement

Le frontend lit l'URL du backend avec:

```env
NEXT_PUBLIC_API_BASE_URL=http://192.168.70.46:3000/api
```

Si cette variable n'existe pas, le fallback actuel dans `lib/api.ts` est `http://192.168.70.46:3000/api`.

## Structure principale

```text
app/
  page.tsx                    Page de connexion
  layout.tsx                  Layout global, theme, preloader, alert listener
  dashboard/                  Tableau de bord dynamique
  live-map/                   Carte en direct et playback
  alarms/                     Alarmes, position GPS et SSE
  geofence/                   Consultation, creation et gestion geofences
  reports/                    Rapports, generation, vue et PDF
  configurations/             Configuration des cadenas
  commands/                   Commandes envoyees aux cadenas
  theme-toggle.tsx            Bouton theme clair/sombre
  user-profile-menu.tsx       Menu utilisateur
lib/
  api.ts                      Base API, auth token, cache frontend, helpers fetch
  error-messages.ts           Messages d'erreur comprehensibles
public/images/
  logo.png                    Logo administration
  logoHarmony.png             Logo Harmony utilise sur login
  loginBg.png                 Image de fond login
  data/custom_geo.json        Coordonnees locales pour les pays
```

## Authentification

La connexion utilise `loginWithCredentials` dans `lib/api.ts`. Apres login, le token est stocke dans `localStorage` sous `pad_lock_access_token`.

Tous les appels API doivent passer par `apiFetch` ou `cachedApiJson`, car ces helpers ajoutent automatiquement le header:

```http
Authorization: Bearer <token>
```

## Gestion API et cache

- `apiFetch(path, options)` fait un fetch vers le backend avec le token.
- `cachedApiJson(path, force)` evite de refaire plusieurs fois le meme GET.
- Le cache est lie au token, donc les donnees d'un utilisateur ne sont pas reutilisees avec un autre token.
- `clearAppCache()` est appele apres certaines actions qui changent des donnees.

## Pages

### Tableau de bord

Le dashboard consomme les endpoints backend de resume et affiche les KPI, activites cadenas, RFID, connexion et heat map.

### Carte en direct

La live map affiche les cadenas avec leurs vraies positions. Elle supporte le mode plan/satellite, les popups, le playback, les vitesses de lecture et la sortie du mode playback.

### Alarmes

La page alarmes affiche les alertes backend et peut ouvrir une carte de position quand l'utilisateur clique une coordonnee.

### Geofences

La page geofence utilise les metadonnees pays depuis le backend et les coordonnees depuis `public/images/data/custom_geo.json`. Quand un pays est selectionne, la carte montre le pays. Une geofence precise est affichee seulement apres clic.

### Rapports

La page rapports charge les resumes depuis le backend, permet de generer des rapports, de les voir et de les telecharger en PDF. Les rapports batterie utilisent un graphique.

### Configurations

La page configurations lit/ecrit les parametres cadenas disponibles via backend: SIM, transmission, vibration, telephone VIP, etc.

### Commandes

La page commandes envoie les actions au backend: redemarrage, deverrouillage, batterie, veille, mot de passe, telephone VIP et RFID.

## Cartes

Les cartes utilisent Leaflet avec deux couches:

- Plan: OpenStreetMap.
- Satellite: Esri World Imagery.

## Theme sombre

Le theme sombre est applique avec la classe `html.dark`. Le choix est stocke dans `localStorage` avec la cle `pad-lock-theme`.

## Gestion des erreurs

Les erreurs techniques sont converties via `userFriendlyError` pour eviter d'afficher des messages developpeur comme `fetch failed` ou des objets JSON bruts.

