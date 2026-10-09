# Tester AURUM sur une base locale jetable

Pour essayer une modification sans toucher à la base Neon : un Postgres local, et un petit
relais qui permet au driver Neon (WebSocket) de lui parler.

```bash
# 1. Un Postgres local (ici sur le port 5433) et une base vide
createdb -h localhost -p 5433 -U postgres aurum_test

# 2. Le schéma
DATABASE_URL=postgresql://postgres@localhost:5433/aurum_test npx prisma db push

# 3. Le relais WebSocket → Postgres (laisser tourner)
node scripts/dev/pg-ws-proxy.mjs

# 4. L'app, branchée sur cette base
DATABASE_URL=postgresql://postgres@localhost:5433/aurum_test \
LOCAL_PG_WS_PROXY=localhost:5488 \
SESSION_SECRET=une-longue-chaine-de-test \
npm run dev
```

`LOCAL_PG_WS_PROXY` n'est lu qu'en développement (`NODE_ENV !== "production"`) : en
production, rien ne change. Sans `ANTHROPIC_API_KEY`, l'assistant utilise le parseur à
règles ; avec, il appelle Claude.
