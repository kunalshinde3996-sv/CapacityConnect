import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Router } from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import {
  assessmentsRouter,
  courseAssessmentsRouter,
  courseProgressRouter,
  myAssessmentsRouter,
} from './modules/assessments/assessments.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { claimsRouter, competenciesRouter, myClaimsRouter, skillGapsRouter, verificationsRouter } from './modules/competency/claims.routes.js';
import { subjectsRouter } from './modules/competency/subjects.routes.js';
import { coursesRouter, myCoursesRouter } from './modules/courses/courses.routes.js';
import { libraryRouter } from './modules/courses/library.routes.js';
import { filesRouter } from './modules/storage/files.routes.js';
import { announcementsRouter, notificationsRouter } from './modules/notifications/notifications.routes.js';
import { applicationsRouter } from './modules/users/applications.routes.js';
import { auditLogRouter, dashboardRouter } from './modules/users/dashboard.routes.js';
import { documentsRouter, profileRouter } from './modules/users/profile.routes.js';
import { usersRouter } from './modules/users/users.routes.js';

// Every API router and where it is mounted. Kept as one list so the route audit
// (lib/routeTable.ts + tests/routes.audit.test.ts) sees exactly what the app serves.
// Order matters: more specific prefixes (e.g. /api/me/claims) before /api/me.
export const ROUTES: [string, Router][] = [
  ['/api/health', healthRouter],
  ['/api/auth', authRouter],
  ['/api/users', usersRouter],
  ['/api/subjects', subjectsRouter],
  ['/api/files', filesRouter],
  ['/api/me/notifications', notificationsRouter],
  ['/api/me/claims', myClaimsRouter],
  ['/api/me/courses', myCoursesRouter],
  ['/api/me/assessments', myAssessmentsRouter],
  ['/api/me', profileRouter],
  ['/api/documents', documentsRouter],
  ['/api/competencies', competenciesRouter],
  ['/api/claims', claimsRouter],
  ['/api/verifications', verificationsRouter],
  ['/api/trainer-applications', applicationsRouter],
  ['/api/dashboard', dashboardRouter],
  ['/api/audit-log', auditLogRouter],
  ['/api/skill-gaps', skillGapsRouter],
  ['/api/announcements', announcementsRouter],
  ['/api/courses/:courseId/assessments', courseAssessmentsRouter],
  ['/api/courses/:courseId/progress', courseProgressRouter],
  ['/api/courses', coursesRouter],
  ['/api/assessments', assessmentsRouter],
  ['/api/library', libraryRouter],
];

// Builds the Express app without starting a server, so tests can import it
// and call it directly with Supertest.
export function createApp() {
  const app = express();
  // Behind the hosting proxies, trust exactly TRUST_PROXY_HOPS of them when reading the
  // client IP from X-Forwarded-For (trusting more would let clients fake their IP).
  app.set('trust proxy', env.TRUST_PROXY_HOPS);

  app.use(helmet());
  // credentials: true lets the browser send the HttpOnly refresh-token cookie.
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  for (const [prefix, router] of ROUTES) app.use(prefix, router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
