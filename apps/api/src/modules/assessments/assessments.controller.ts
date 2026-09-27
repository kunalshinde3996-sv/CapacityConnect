import type { Request, Response } from 'express';
import type { Actor } from '../courses/courses.service.js';
import * as assessmentsService from './assessments.service.js';
import * as monitoringService from './monitoring.service.js';

const actor = (req: Request) => req.user! as Actor;
const p = (req: Request, name: string) => req.params[name] as string;

export async function listForCourse(req: Request, res: Response) {
  res.json({ assessments: await assessmentsService.listForCourse(actor(req), p(req, 'courseId')) });
}

export async function create(req: Request, res: Response) {
  res.status(201).json({ assessment: await assessmentsService.createAssessment(actor(req), p(req, 'courseId'), req.body) });
}

export async function get(req: Request, res: Response) {
  res.json({ assessment: await assessmentsService.getAssessment(actor(req), p(req, 'id')) });
}

export async function update(req: Request, res: Response) {
  res.json({ assessment: await assessmentsService.updateAssessment(actor(req), p(req, 'id'), req.body) });
}

export const setPublished = (published: boolean) => async (req: Request, res: Response) => {
  res.json({ assessment: await assessmentsService.setPublished(actor(req), p(req, 'id'), published) });
};

export async function start(req: Request, res: Response) {
  res.json(await assessmentsService.start(req.user!.id, p(req, 'id')));
}

export async function submit(req: Request, res: Response) {
  res.json({ result: await assessmentsService.submit(req.user!.id, p(req, 'id'), req.body.answers) });
}

export async function result(req: Request, res: Response) {
  res.json({ result: await assessmentsService.getResult(req.user!.id, p(req, 'id')) });
}

export async function mine(req: Request, res: Response) {
  res.json({ assessments: await assessmentsService.myAssessments(req.user!.id) });
}

export async function progress(req: Request, res: Response) {
  res.json(await monitoringService.courseProgress(actor(req), p(req, 'courseId')));
}
