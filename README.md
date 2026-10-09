# OROM

> Dis-le. OROM s'en occupe.

Un assistant personnel pour organiser études, travail, projets, santé et vie quotidienne,
à la voix ou au clavier. Next.js 16, Prisma 7, Postgres (Neon).

## Démarrer en local

```bash
npm install
cp .env.example .env.local   # DATABASE_URL et SESSION_SECRET au minimum
npm run dev                  # http://localhost:4000
```

Pour travailler sans toucher la base de production : `docs/DEV_LOCAL.md` (Postgres local jetable).

## Vérifier

```bash
npm run lint && npx tsc --noEmit && npm test && npm run build
```

## Documentation

- `docs/ARCHITECTURE.md` — OROM Core, agents, stockage, garanties.
- `docs/DEPLOYMENT.md` — variables, migrations, crons, vérifications.
- `docs/PRIVACY.md` — ce qui est stocké, ce qui sort, contrôle utilisateur.
- `docs/AUDIT.md` — état des fonctionnalités : testé, partiel, manquant.
