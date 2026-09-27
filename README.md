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
- Trainee: `aditya.sharma@imd.example` (the demo journey: 1 assessment due, not yet in the
  ocean course, no rating given yet, trainer application pending)
- Trainer with a teaching record from good feedback: `arjun.menon@imd.example`
- Pending (for the approval demo): `zoya.qureshi@imd.example` and 5 others

Re-running the seed resets demo accounts to these states.

These credentials are public, so they only work on a **local** database. The live site's
demo accounts use a private password (see below).

## Demo walkthrough (Phase 2)

- **Trainee** (`aditya.sharma@imd.example`): My courses (assessment due) → Browse courses → enrol in
  *Ocean Data Analysis with Python* → Library video → take *Argo data warm-up* → result with
  per-competency breakdown and skill levels → rate the course → Profile.
- **Trainer** (`meera.kulkarni@imd.example` or `priya.nair@incois.example`): My teaching → a course → tabs Modules,
  Library, Assessments, Class progress (weakest competencies), Feedback.
- **Admin**: Verifications (Sanjay's and Neha's certificate claims), Trainer applications,
  Trainer matching → *Tropical Cyclone…* → Arjun's "Teaching record" in the breakdown.

Rules worth knowing (all in `apps/api/src/services`, with unit tests):
- Assessment skill levels: only competencies with ≥ 2 questions; ≥ 80% → L3, 50–79% → L2,
  < 50% → L1; never L4; never lowers an admin-set level.
- Feedback as teaching evidence: ≥ 3 ratings averaging ≥ 4.0 → a TEACHING claim (trust 0.8) at
  the course's target level for each course competency, used only where it beats the trainer's
  own claim.

## Deployment (free tier)

```
Browser ──> Vercel (Next.js web) ──/api/* proxy──> Render (Express API) ──> Neon (Postgres)
```

The browser only talks to the Vercel site; Next.js forwards `/api/*` to Render
(`apps/web/next.config.ts`). That keeps the refresh cookie first-party, which Safari needs.

1. **Neon** (database): create a project in region *AWS Asia Pacific (Singapore)*. Copy the
   connection string for the **direct** host (not the one with `-pooler`).
2. **Render** (API): *New → Blueprint* → this repo. It reads `render.yaml`. Set
   `DATABASE_URL` (Neon) and `CORS_ORIGINS` (the Vercel URL, once you have it).
   Migrations run automatically on every start.
3. **Vercel** (web): import this repo, set *Root Directory* to `apps/web`, and add
   `API_ORIGIN` = the Render URL (e.g. `https://capacity-connect-api.onrender.com`).
   Also add `NEXT_PUBLIC_API_ORIGIN` = the same Render URL (file uploads and downloads go
   straight to the API, not through the proxy). Redeploy whenever either changes (both are
   read at build time).
4. **Seed the hosted database** once, from your machine (secrets stay in a gitignored file):

   ```bash
   # apps/api/.env.deploy  (gitignored)
   DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require
   SEED_ALLOW_PROD=true
   SEED_DEMO_PASSWORD=<private password, 12+ characters>
   ```

   ```bash
   npm run hosted:migrate -w apps/api   # create tables on Neon
   npm run hosted:seed -w apps/api      # demo data with your private password
   ```

Free-tier limits: the Render API sleeps after 15 minutes idle and takes up to a minute to
wake (the login page pings it early). Render's disk is wiped on restart: the demo files in
`apps/api/demo-files` are copied back into storage every time the API starts, but files
uploaded on the live site are lost. Moving to object storage only needs a new class behind
the `StorageService` interface (`apps/api/src/modules/storage`).

## Notes

- npm 11 only runs dependency install scripts that are approved in `allowScripts` (root
  `package.json`). Prisma, esbuild and unrs-resolver are approved there.
- ESLint is pinned to 9.x because Next.js's lint rules (`eslint-plugin-react`) do not support
  ESLint 10 yet.
