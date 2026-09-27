import type { Request, Response } from 'express';
import * as auditLogService from './auditLog.service.js';
import * as dashboardService from './dashboard.service.js';

export async function get(_req: Request, res: Response) {
  res.json(await dashboardService.getDashboard());
}

export async function auditLog(req: Request, res: Response) {
  res.json(await auditLogService.listAuditLog(auditLogService.auditQuerySchema.parse(req.query)));
}
