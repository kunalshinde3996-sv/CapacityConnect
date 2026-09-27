import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import * as controller from './users.controller.js';
import { changeRoleSchema, reasonSchema } from './users.schemas.js';

// Admin-only user management. There is intentionally no DELETE route:
// accounts are disabled, never deleted.
export const usersRouter = Router();

usersRouter.use(requireAuth, requireRole('ADMIN'));

usersRouter.get('/', controller.list); // ?status=PENDING&role=TRAINEE&page=1
usersRouter.post('/:id/approve', controller.approve);
usersRouter.post('/:id/reject', validateBody(reasonSchema), controller.reject);
usersRouter.post('/:id/disable', validateBody(reasonSchema), controller.disable);
usersRouter.post('/:id/enable', controller.enable);
usersRouter.patch('/:id/role', validateBody(changeRoleSchema), controller.changeRole);
