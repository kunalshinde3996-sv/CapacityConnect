import type { Request, Response } from 'express';
import * as subjectsService from './subjects.service.js';

export async function list(_req: Request, res: Response) {
  res.json({ subjects: await subjectsService.listSubjects() });
}

export async function trainerMatches(req: Request, res: Response) {
  res.json(await subjectsService.getTrainerMatches(req.params.id as string));
}
