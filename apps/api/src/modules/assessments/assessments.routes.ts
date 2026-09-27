import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import * as controller from './assessments.controller.js';
import { assessmentInputSchema, submitSchema } from './assessments.schemas.js';

const staff = requireRole('TRAINER', 'ADMIN');

// /api/courses/:courseId/assessments
export const courseAssessmentsRouter = Router({ mergeParams: true });
courseAssessmentsRouter.use(requireAuth);
courseAssessmentsRouter.get('/', controller.listForCourse);
courseAssessmentsRouter.post('/', staff, validateBody(assessmentInputSchema), controller.create);

// /api/assessments/:id
export const assessmentsRouter = Router();
assessmentsRouter.use(requireAuth);
assessmentsRouter.get('/:id', controller.get); // trainer: with answers; trainee: never
assessmentsRouter.put('/:id', staff, validateBody(assessmentInputSchema), controller.update);
assessmentsRouter.post('/:id/publish', staff, controller.setPublished(true));
assessmentsRouter.post('/:id/unpublish', staff, controller.setPublished(false));

const trainee = requireRole('TRAINEE');
assessmentsRouter.post('/:id/start', trainee, controller.start);
assessmentsRouter.post('/:id/submit', trainee, validateBody(submitSchema), controller.submit);
assessmentsRouter.get('/:id/result', trainee, controller.result);

// /api/me/assessments - a trainee's assessments across enrolled courses
export const myAssessmentsRouter = Router();
myAssessmentsRouter.get('/', requireAuth, trainee, controller.mine);

// /api/courses/:courseId/progress - trainer monitoring (course trainer or admin)
export const courseProgressRouter = Router({ mergeParams: true });
courseProgressRouter.get('/', requireAuth, staff, controller.progress);
