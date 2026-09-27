import { Router } from 'express';

export const healthRouter = Router();

// Used by the hosting platform and uptime checks. Deliberately does not touch the DB.
healthRouter.get('/', (_req, res) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
});
