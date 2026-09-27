import type { Request, Response } from 'express';
import * as dashboardService from './dashboard.service.js';

export async function get(_req: Request, res: Response) {
  res.json(await dashboardService.getDashboard());
}
