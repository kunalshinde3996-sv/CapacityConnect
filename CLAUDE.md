# Capacity Connect

SIH 2026 prototype for PS SIH26075 (Ministry of Earth Sciences): a competency-mapped
training and learning management portal for MoES institutes (IMD, INCOIS, NCPOR, etc.).

## Core idea (the USP)
Every profile, course, question and trainer is linked to ONE shared competency framework.
This lets the system:
1. Rank trainers for a subject with an explainable fit score ("why this trainer").
2. Report assessment results per competency ("strong in X, weak in Y"), not just a total.
3. Show admins an organisation-wide skill-gap view.
Verified evidence counts more than self-declared skills.

## Users (RBAC)
- TRAINEE: profile (qualifications, experience, interests, skills, certificates), enrol in courses,
  use trainer library, attempt subject-wise MCQs before deadlines, give course feedback.
- TRAINER: profile + competency claims with evidence, upload lectures/slides/notes to the library,
  create MCQ questionnaires with deadlines, monitor participation and performance.
- ADMIN: approve users, manage roles, verify credentials, manage competency framework,
  dashboards (courses, enrolments, certifications, assessments, participation),
  publish announcements / achievements / new content on the homepage.
New users are PENDING until an admin approves them.

## Stack
- Monorepo with npm workspaces: `apps/api`, `apps/web`
- API: Node.js + TypeScript + Express, Prisma ORM, PostgreSQL, zod validation
- Web: Next.js (App Router) + React + TypeScript + Tailwind CSS
- Auth: JWT access token (15 min) + refresh token in HttpOnly cookie (7 days), bcrypt password hashing
- Email: Nodemailer (logs emails to console in development, SMTP in production)
- Tests: Vitest (API unit tests), Supertest (API route tests)
- Local DB: PostgreSQL via docker-compose

## Competency matching rules (must stay transparent, NO ML/AI)
- Proficiency levels: 1 Aware, 2 Working, 3 Proficient, 4 Expert
- A Subject has requirements: (competency, minLevel, weight). Weights for a subject sum to 1.0.
- A trainer claim has: (competency, level, evidenceType, verified)
- Evidence trust: VERIFIED certificate/qualification = 1.0, EXPERIENCE or TEACHING record = 0.8,
  SELF_DECLARED = 0.5
- For each requirement: coverage = min(trainerLevel / minLevel, 1) x trust  (0 if no claim)
- fitScore = sum(weight x coverage), shown as a percentage
- If any required competency has no claim at all, mark the trainer as "partial fit"
- The API must return the per-competency breakdown so the UI can explain every score.

## Architecture (must match the diagram in our approved PPT)
- Client (Trainee / Trainer / Admin) -> Next.js frontend -> HTTPS REST -> Express API (a modular monolith)
- Auth module: JWT + RBAC middleware; access token 15 min, refresh token 7 days in HttpOnly cookie
- API modules, one folder each under apps/api/src/modules: auth, users, courses, enrollments,
  assessments, competency, notifications, storage
- Storage service abstraction -> local disk (/uploads) for now
- Prisma ORM -> PostgreSQL (normalised schema)
- Core domain entities from the diagram: User (role enum), Course, CourseModule, Competency,
  CourseCompetency, Enrollment, Assessment, Question (JSONB options), AssessmentAttempt,
  UserCompetency, Notification, TrainerApplication
- Additional entities needed for trainer matching and the PS requirements: Subject,
  SubjectRequirement, TrainerCompetency, Certificate, LibraryItem, Feedback, Announcement, AuditLog
- Keep these entity names so the code matches the architecture slide.

## Engineering rules
- Keep it simple. This is a 30-day student prototype, not an enterprise system.
- Layering in the API: routes -> controllers -> services -> Prisma. No business logic in routes.
- Validate every request body with zod. Return consistent JSON errors: { error: { code, message } }.
- Enforce roles on the server, never only in the UI.
- Never commit secrets. Use `.env` + `.env.example`.
- Uploaded files: validate type and size, store behind a small storage interface (local disk for now),
  serve only to authorised users.
- Do NOT add: offline sync, AI/chatbots, WebSockets, video transcoding, microservices, Redis, Kubernetes.
- Ask before adding any new dependency that is not in the stack above.
- After each feature: run tests + typecheck, then make a small, clear git commit.
- Explain important decisions briefly in your summary; I am a student and want to understand the code.
