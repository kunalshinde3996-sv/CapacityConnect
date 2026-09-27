import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import * as controller from './dashboard.controller.js';

// GET /api/dashboard - organisation-wide numbers for the admin dashboard
export const dashboardRouter = Router();
dashboardRouter.get('/', requireAuth, requireRole('ADMIN'), controller.get);
