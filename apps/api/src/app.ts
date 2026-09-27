import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { subjectsRouter } from './modules/competency/subjects.routes.js';
import { usersRouter } from './modules/users/users.routes.js';

// Builds the Express app without starting a server, so tests can import it
// and call it directly with Supertest.
export function createApp() {
  const app = express();

  app.use(helmet());
  // credentials: true lets the browser send the HttpOnly refresh-token cookie.
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/subjects', subjectsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
