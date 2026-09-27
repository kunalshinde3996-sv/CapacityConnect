import { type Request, type Response, Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { reviewSchema } from '../competency/claims.schemas.js';
import * as applicationsService from './applications.service.js';

const listQuery = z.object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional() });

// /api/trainer-applications - admin review of "I want to become a trainer" requests
export const applicationsRouter = Router();
applicationsRouter.use(requireAuth, requireRole('ADMIN'));

applicationsRouter.get('/', async (req: Request, res: Response) => {
  res.json({ applications: await applicationsService.listApplications(listQuery.parse(req.query).status) });
});

applicationsRouter.post('/:id/review', validateBody(reviewSchema), async (req: Request, res: Response) => {
  const application = await applicationsService.reviewApplication(
    req.user!.id,
    req.params.id as string,
    req.body.decision,
    req.body.reason,
  );
  res.json({ application });
});
