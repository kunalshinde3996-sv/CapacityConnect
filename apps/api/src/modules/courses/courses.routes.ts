import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import * as controller from './courses.controller.js';
import {
  assignTrainerSchema,
  createCourseSchema,
  feedbackSchema,
  moduleSchema,
  moveModuleSchema,
  updateCourseSchema,
} from './courses.schemas.js';

export const coursesRouter = Router();
coursesRouter.use(requireAuth);

// Browsing: any signed-in user (drafts only for their trainer/admin, checked in the service)
coursesRouter.get('/', controller.list); // ?q=&subjectId=&competencyId=&mine=true&all=true
coursesRouter.get('/:id', controller.get);

// Creating and editing: trainers and admins (course ownership is checked in the service)
const staff = requireRole('TRAINER', 'ADMIN');
coursesRouter.post('/', staff, validateBody(createCourseSchema), controller.create);
coursesRouter.patch('/:id', staff, validateBody(updateCourseSchema), controller.update);
coursesRouter.post('/:id/publish', staff, controller.setStatus('PUBLISHED'));
coursesRouter.post('/:id/archive', staff, controller.setStatus('ARCHIVED'));
coursesRouter.post('/:id/unpublish', staff, controller.setStatus('DRAFT'));

coursesRouter.post('/:id/modules', staff, validateBody(moduleSchema), controller.addModule);
coursesRouter.patch('/:id/modules/:moduleId', staff, validateBody(moduleSchema), controller.updateModule);
coursesRouter.delete('/:id/modules/:moduleId', staff, controller.deleteModule);
coursesRouter.post('/:id/modules/:moduleId/move', staff, validateBody(moveModuleSchema), controller.moveModule);

coursesRouter.put('/:id/trainer', requireRole('ADMIN'), validateBody(assignTrainerSchema), controller.assignTrainer);

coursesRouter.post('/:id/enroll', requireRole('TRAINEE'), controller.enroll);

// Feedback: trainees rate (once, editable); the trainer sees the summary and comments
coursesRouter.put('/:id/feedback', requireRole('TRAINEE'), validateBody(feedbackSchema), controller.saveFeedback);
coursesRouter.get('/:id/feedback', controller.getFeedback);

// GET /api/me/courses - a trainee's enrolments
export const myCoursesRouter = Router();
myCoursesRouter.get('/', requireAuth, requireRole('TRAINEE'), controller.myCourses);
