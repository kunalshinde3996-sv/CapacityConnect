import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { announcementSchema } from './notifications.schemas.js';
import * as controller from './notifications.controller.js';

// /api/me/notifications - the signed-in user's in-app notifications
export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);
notificationsRouter.get('/', controller.list); // also creates due deadline reminders for trainees
notificationsRouter.get('/unread-count', controller.unread); // cheap; the web app polls this
notificationsRouter.post('/read-all', controller.markAllRead);
notificationsRouter.post('/:id/read', controller.markRead);

// /api/announcements
export const announcementsRouter = Router();
announcementsRouter.get('/public', controller.publicFeed); // homepage: no sign-in needed
announcementsRouter.use(requireAuth, requireRole('ADMIN'));
announcementsRouter.get('/', controller.listAnnouncements);
announcementsRouter.post('/', validateBody(announcementSchema), controller.createAnnouncement);
announcementsRouter.put('/:id', validateBody(announcementSchema), controller.updateAnnouncement);
announcementsRouter.post('/:id/publish', controller.setAnnouncementPublished(true));
announcementsRouter.post('/:id/unpublish', controller.setAnnouncementPublished(false));
