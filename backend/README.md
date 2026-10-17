# RaHel backend

API Express + TypeScript.

```bash
npm install
npm run dev
```

**SQLite:** `data/rahel.db` (override con `RAHEL_DB_PATH`). Al primer arranque se cargan datos desde `data/seed-dashboard.json` si la base está vacía. Borra el `.db` para re-sembrar.

- Puerto **8080** por defecto (alineado con el emulador Android `10.0.2.2:8080`).
- Ver `docs/API.md` para ingesta Wear y endpoints del dashboard.
