import type { Request, Response } from 'express';
import { z } from 'zod';
import * as applicationsService from './applications.service.js';

const listQuery = z.object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional() });

export async function list(req: Request, res: Response) {
  res.json({ applications: await applicationsService.listApplications(listQuery.parse(req.query).status) });
}

export async function review(req: Request, res: Response) {
  const application = await applicationsService.reviewApplication(
    req.user!.id,
    req.params.id as string,
    req.body.decision,
    req.body.reason,
  );
  res.json({ application });
}
