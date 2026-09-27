import type { Request, Response } from 'express';
import * as announcementsService from './announcements.service.js';
import * as notificationsService from './notifications.service.js';

const id = (req: Request) => req.params.id as string;

// ── The signed-in user's notifications ──

export async function list(req: Request, res: Response) {
  res.json(await notificationsService.listForUser(req.user!.id, req.user!.role));
}

export async function unread(req: Request, res: Response) {
  res.json({ unread: await notificationsService.unreadCount(req.user!.id, req.user!.role) });
}

export async function markRead(req: Request, res: Response) {
  await notificationsService.markRead(req.user!.id, id(req));
  res.status(204).end();
}

export async function markAllRead(req: Request, res: Response) {
  await notificationsService.markAllRead(req.user!.id);
  res.status(204).end();
}

// ── Announcements ──

export async function publicFeed(_req: Request, res: Response) {
  res.json(await announcementsService.publicFeed());
}

export async function listAnnouncements(_req: Request, res: Response) {
  res.json({ announcements: await announcementsService.listAll() });
}

export async function createAnnouncement(req: Request, res: Response) {
  res.status(201).json({ announcement: await announcementsService.create(req.user!.id, req.body) });
}

export async function updateAnnouncement(req: Request, res: Response) {
  res.json({ announcement: await announcementsService.update(req.user!.id, id(req), req.body) });
}

export const setAnnouncementPublished = (published: boolean) => async (req: Request, res: Response) => {
  res.json({ announcement: await announcementsService.setPublished(req.user!.id, id(req), published) });
};
