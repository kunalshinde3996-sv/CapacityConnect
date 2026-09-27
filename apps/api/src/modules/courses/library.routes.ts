import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { acceptUpload } from '../storage/upload.middleware.js';
import * as controller from './library.controller.js';
import { createLibraryItemSchema, LIBRARY_KINDS, updateLibraryItemSchema } from './library.schemas.js';

// /api/library - lectures, slides and notes uploaded by trainers, tagged with competencies.
// Files are only reachable through short-lived signed links handed to signed-in users.
export const libraryRouter = Router();
libraryRouter.use(requireAuth);

libraryRouter.get('/', controller.list); // ?q=&type=&competencyId=&courseId=&mine=true
libraryRouter.get('/:id', controller.get);
libraryRouter.get('/:id/file', controller.file);

const staff = requireRole('TRAINER', 'ADMIN');
libraryRouter.post('/', staff, ...acceptUpload('file', LIBRARY_KINDS, { required: true }), validateBody(createLibraryItemSchema), controller.create);
libraryRouter.patch('/:id', staff, validateBody(updateLibraryItemSchema), controller.update);
libraryRouter.delete('/:id', staff, controller.remove);
