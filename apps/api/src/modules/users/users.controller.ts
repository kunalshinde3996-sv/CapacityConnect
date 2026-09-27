import type { Request, Response } from 'express';
import { listUsersQuerySchema } from './users.schemas.js';
import * as usersService from './users.service.js';

// `req.user!` is safe here: these handlers only run after requireAuth.
// `req.params.id as string`: Express types params loosely; the route always has :id.

export async function list(req: Request, res: Response) {
  res.json(await usersService.listUsers(listUsersQuerySchema.parse(req.query)));
}

export async function approve(req: Request, res: Response) {
  res.json({ user: await usersService.approveUser(req.user!.id, req.params.id as string) });
}

export async function reject(req: Request, res: Response) {
  res.json({ user: await usersService.rejectUser(req.user!.id, req.params.id as string, req.body.reason) });
}

export async function disable(req: Request, res: Response) {
  res.json({ user: await usersService.disableUser(req.user!.id, req.params.id as string, req.body.reason) });
}

export async function enable(req: Request, res: Response) {
  res.json({ user: await usersService.enableUser(req.user!.id, req.params.id as string) });
}

export async function changeRole(req: Request, res: Response) {
  res.json({ user: await usersService.changeRole(req.user!.id, req.params.id as string, req.body.role) });
}
