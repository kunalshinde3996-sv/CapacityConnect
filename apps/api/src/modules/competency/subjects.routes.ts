import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import * as controller from './subjects.controller.js';

export const subjectsRouter = Router();

// Trainer matching is an admin tool for now (it exposes every trainer's evidence).
subjectsRouter.use(requireAuth, requireRole('ADMIN'));

subjectsRouter.get('/', controller.list);
subjectsRouter.get('/:id/trainer-matches', controller.trainerMatches);
