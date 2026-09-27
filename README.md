# Capacity Connect

Competency-mapped training and learning management portal for Ministry of Earth Sciences
institutes (SIH 2026, PS SIH26075). See `CLAUDE.md` for the product idea and rules.

## Structure

```
apps/api   Express + TypeScript + Prisma (PostgreSQL) REST API   -> http://localhost:4000
apps/web   Next.js (App Router) + Tailwind frontend               -> http://localhost:3000
```

## First-time setup

Requirements: Node.js 22.12+ (24 recommended), Docker Desktop.

```bash
npm install                                   # installs both apps (npm workspaces)
cp apps/api/.env.example apps/api/.env        # then edit the JWT secrets
cp apps/web/.env.example apps/web/.env.local
npm run db:up                                 # Postgres in Docker on host port 5433
npm run db:migrate                            # create tables
npm run db:seed                               # demo data (safe to re-run)
npm run dev                                   # API + web together
```

## Scripts (run from the repo root)

| Script              | What it does                                   |
| ------------------- | ---------------------------------------------- |
| `npm run dev`       | API (watch mode) and web dev server together   |
| `npm run build`     | Production build of both apps                  |
| `npm test`          | API unit + route tests (needs `npm run db:up`) |
| `npm run typecheck` | TypeScript check for both apps                 |
| `npm run lint`      | ESLint for both apps                           |
| `npm run db:up`     | Start the local Postgres container             |
| `npm run db:migrate`| Apply Prisma migrations to the dev database    |
| `npm run db:seed`   | Load/reset demo data (idempotent)              |

## Demo logins (after seeding)

Password for every demo account: `Demo@2026`

- Admin: `admin@moes.example`
- Trainer: `meera.kulkarni@imd.example` (and 7 others, printed by the seed)
- Trainee: `aditya.sharma@imd.example`
- Pending (for the approval demo): `zoya.qureshi@imd.example` and 5 others

Re-running the seed resets demo accounts to these states.

## Notes

- npm 11 only runs dependency install scripts that are approved in `allowScripts` (root
  `package.json`). Prisma, esbuild and unrs-resolver are approved there.
- ESLint is pinned to 9.x because Next.js's lint rules (`eslint-plugin-react`) do not support
  ESLint 10 yet.
