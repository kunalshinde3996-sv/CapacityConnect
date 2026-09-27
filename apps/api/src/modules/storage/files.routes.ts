import { Router } from 'express';
import { AppError } from '../../lib/errors.js';
import { verifyFileLink } from './fileLinks.js';
import { mimeForKey } from './fileTypes.js';
import { storage } from './storage.service.js';

export const filesRouter = Router();

// GET /api/files?k=&n=&e=&s=  - the signature IS the permission (see fileLinks.ts),
// so there is no requireAuth here. Links are only handed out to authorised users.
filesRouter.get('/', async (req, res) => {
  const link = verifyFileLink(req.query);
  if (!link) throw new AppError(403, 'INVALID_FILE_LINK', 'This file link is invalid or has expired. Reopen it from the app');

  const type = mimeForKey(link.fileKey);
  const disposition = type.inline ? 'inline' : 'attachment';
  await storage.send(link.fileKey, res, {
    'Content-Type': type.mime,
    'Content-Disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(link.downloadName)}`,
    // The web app (another origin in production) embeds videos and images from here.
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Cache-Control': 'private, max-age=600',
  });
});
