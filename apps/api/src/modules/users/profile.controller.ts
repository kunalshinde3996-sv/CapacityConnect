import type { Request, Response } from 'express';
import * as profileService from './profile.service.js';

// All handlers run after requireAuth, so req.user is set.
const me = (req: Request) => req.user!;
const id = (req: Request) => req.params.id as string;

export async function get(req: Request, res: Response) {
  res.json({ profile: await profileService.getProfile(me(req).id) });
}

export async function update(req: Request, res: Response) {
  res.json({ profile: await profileService.updateProfile(me(req).id, me(req).role, req.body) });
}

export async function addQualification(req: Request, res: Response) {
  res.status(201).json({ qualification: await profileService.addQualification(me(req).id, req.body, req.upload) });
}

export async function deleteQualification(req: Request, res: Response) {
  await profileService.deleteQualification(me(req).id, id(req));
  res.status(204).end();
}

export async function qualificationFile(req: Request, res: Response) {
  res.json(await profileService.qualificationFileLink(me(req), id(req)));
}

export async function addExperience(req: Request, res: Response) {
  res.status(201).json({ experience: await profileService.addExperience(me(req).id, req.body) });
}

export async function deleteExperience(req: Request, res: Response) {
  await profileService.deleteExperience(me(req).id, id(req));
  res.status(204).end();
}

export async function addCertificate(req: Request, res: Response) {
  res.status(201).json({ certificate: await profileService.addCertificate(me(req).id, req.body, req.upload!) });
}

export async function deleteCertificate(req: Request, res: Response) {
  await profileService.deleteCertificate(me(req).id, id(req));
  res.status(204).end();
}

export async function certificateFile(req: Request, res: Response) {
  res.json(await profileService.certificateFileLink(me(req), id(req)));
}

export async function setSkills(req: Request, res: Response) {
  res.json({ profile: await profileService.setSkills(me(req).id, req.body) });
}

export async function apply(req: Request, res: Response) {
  res.status(201).json({ application: await profileService.applyForTrainer(me(req).id, me(req).role, req.body) });
}
