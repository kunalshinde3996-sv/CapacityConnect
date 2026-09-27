import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { reviewSchema } from '../competency/claims.schemas.js';
import * as controller from './applications.controller.js';

// /api/trainer-applications - admin review of "I want to become a trainer" requests
export const applicationsRouter = Router();
applicationsRouter.use(requireAuth, requireRole('ADMIN'));

applicationsRouter.get('/', controller.list); // ?status=PENDING
applicationsRouter.post('/:id/review', validateBody(reviewSchema), controller.review);
