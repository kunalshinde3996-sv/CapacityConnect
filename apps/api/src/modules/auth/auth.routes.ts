import { Router } from 'express';
import { authIpLimiter, limitByIp } from '../../lib/rateLimit.js';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import * as controller from './auth.controller.js';
import { loginSchema, registerSchema } from './auth.schemas.js';

export const authRouter = Router();

// Rate limited per IP; login is also limited per account (see auth.service.ts).
authRouter.post('/register', limitByIp(authIpLimiter), validateBody(registerSchema), controller.register);
authRouter.post('/login', limitByIp(authIpLimiter), validateBody(loginSchema), controller.login);
authRouter.post('/refresh', controller.refresh);
authRouter.post('/logout', controller.logout);
authRouter.get('/me', requireAuth, controller.me);
