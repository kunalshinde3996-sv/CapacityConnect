import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import * as controller from './subjects.controller.js';

export const subjectsRouter = Router();
subjectsRouter.use(requireAuth);

// Trainers see the subject list too, to link their courses to a subject.
subjectsRouter.get('/', requireRole('ADMIN', 'TRAINER'), controller.list);
// Trainer matching stays admin-only (it exposes every trainer's evidence).
subjectsRouter.get('/:id/trainer-matches', requireRole('ADMIN'), controller.trainerMatches);
