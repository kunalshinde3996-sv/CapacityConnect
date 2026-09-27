import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { acceptUpload } from '../storage/upload.middleware.js';
import * as controller from './claims.controller.js';
import { claimSchema, reviewSchema } from './claims.schemas.js';

// GET /api/competencies - the shared framework, for pickers in the UI (any signed-in user)
export const competenciesRouter = Router();
competenciesRouter.get('/', requireAuth, controller.listCompetencies);

// /api/me/claims - a trainer's own competency claims
export const myClaimsRouter = Router();
myClaimsRouter.use(requireAuth, requireRole('TRAINER'));
myClaimsRouter.put(
  '/',
  ...acceptUpload('evidenceFile', ['pdf', 'png', 'jpg', 'docx'], { required: false }),
  validateBody(claimSchema),
  controller.saveClaim,
);
myClaimsRouter.delete('/:competencyId', controller.deleteClaim);

// /api/claims/:id/evidence - short-lived link to a claim's evidence file (owner or admin)
export const claimsRouter = Router();
claimsRouter.get('/:id/evidence', requireAuth, controller.evidenceFile);

// /api/verifications - the admin verification queue
export const verificationsRouter = Router();
verificationsRouter.use(requireAuth, requireRole('ADMIN'));
verificationsRouter.get('/', controller.queue);
verificationsRouter.post('/claims/:id', validateBody(reviewSchema), controller.reviewClaim);
verificationsRouter.post('/certificates/:id', validateBody(reviewSchema), controller.reviewCertificate);
verificationsRouter.post('/qualifications/:id', validateBody(reviewSchema), controller.reviewQualification);
