import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { acceptUpload } from '../storage/upload.middleware.js';
import * as controller from './profile.controller.js';
import {
  applicationSchema,
  certificateSchema,
  experienceSchema,
  qualificationSchema,
  skillsSchema,
  updateProfileSchema,
} from './profile.schemas.js';

// The signed-in user's own profile: /api/me/...
export const profileRouter = Router();
profileRouter.use(requireAuth);

profileRouter.get('/profile', controller.get);
profileRouter.patch('/profile', validateBody(updateProfileSchema), controller.update);

// File uploads are multipart forms: the upload middleware runs first, then zod checks the text fields.
profileRouter.post(
  '/qualifications',
  ...acceptUpload('file', ['pdf', 'png', 'jpg'], { required: false }),
  validateBody(qualificationSchema),
  controller.addQualification,
);
profileRouter.delete('/qualifications/:id', controller.deleteQualification);

profileRouter.post('/experiences', validateBody(experienceSchema), controller.addExperience);
profileRouter.delete('/experiences/:id', controller.deleteExperience);

profileRouter.post(
  '/certificates',
  ...acceptUpload('file', ['pdf', 'png', 'jpg'], { required: true }),
  validateBody(certificateSchema),
  controller.addCertificate,
);
profileRouter.delete('/certificates/:id', controller.deleteCertificate);

profileRouter.put('/skills', requireRole('TRAINEE'), validateBody(skillsSchema), controller.setSkills);
profileRouter.post('/trainer-application', requireRole('TRAINEE'), validateBody(applicationSchema), controller.apply);

// Short-lived links to view documents (owner or admin). Mounted at /api/documents.
export const documentsRouter = Router();
documentsRouter.use(requireAuth);
documentsRouter.get('/certificates/:id/file', controller.certificateFile);
documentsRouter.get('/qualifications/:id/file', controller.qualificationFile);
