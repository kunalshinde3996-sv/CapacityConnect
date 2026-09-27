import type { Request, Response } from 'express';
import * as claimsService from './claims.service.js';
import * as verificationService from './verification.service.js';

const param = (req: Request, name: string) => req.params[name] as string;

export async function listCompetencies(_req: Request, res: Response) {
  res.json({ competencies: await claimsService.listCompetencies() });
}

export async function saveClaim(req: Request, res: Response) {
  res.json({ claim: await claimsService.saveClaim(req.user!.id, req.body, req.upload) });
}

export async function deleteClaim(req: Request, res: Response) {
  await claimsService.deleteClaim(req.user!.id, param(req, 'competencyId'));
  res.status(204).end();
}

export async function evidenceFile(req: Request, res: Response) {
  res.json(await claimsService.claimEvidenceLink(req.user!, param(req, 'id')));
}

export async function queue(_req: Request, res: Response) {
  res.json(await verificationService.getQueue());
}

export async function reviewClaim(req: Request, res: Response) {
  res.json({ claim: await verificationService.reviewClaim(req.user!.id, param(req, 'id'), req.body) });
}

export async function reviewCertificate(req: Request, res: Response) {
  res.json(await verificationService.reviewDocument(req.user!.id, 'certificate', param(req, 'id'), req.body));
}

export async function reviewQualification(req: Request, res: Response) {
  res.json(await verificationService.reviewDocument(req.user!.id, 'qualification', param(req, 'id'), req.body));
}
