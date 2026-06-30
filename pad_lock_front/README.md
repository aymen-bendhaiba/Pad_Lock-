# Pad Lock Frontend

Frontend web pour la supervision et la gestion des cadenas connectes Pad Lock.

## Demarrage

```bash
npm install
npm run dev
```

Par defaut, l'application utilise l'API definie par `NEXT_PUBLIC_API_BASE_URL`. Si la variable n'est pas definie, le fallback actuel est dans `lib/api.ts`.

## Documentation

- [Documentation frontend](docs/FRONTEND_DOCUMENTATION.md)
- [Pourquoi on utilise chaque element](docs/WHY_WE_USE_THIS.md)

## Commandes utiles

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Notes

Les dossiers/fichiers generes comme `.next` et `tsconfig.tsbuildinfo` ne doivent pas etre gardes dans le projet. Ils sont recrees automatiquement par Next.js et TypeScript.