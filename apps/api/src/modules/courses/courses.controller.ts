import type { Request, Response } from 'express';
import * as enrollmentsService from '../enrollments/enrollments.service.js';
import { listCoursesQuerySchema } from './courses.schemas.js';
import * as coursesService from './courses.service.js';
import * as feedbackService from './feedback.service.js';

// All handlers run after requireAuth, so req.user is set.
const actor = (req: Request) => req.user! as coursesService.Actor;
const p = (req: Request, name: string) => req.params[name] as string;

export async function list(req: Request, res: Response) {
  res.json({ courses: await coursesService.listCourses(actor(req), listCoursesQuerySchema.parse(req.query)) });
}

export async function get(req: Request, res: Response) {
  res.json({ course: await coursesService.getCourse(actor(req), p(req, 'id')) });
}

export async function create(req: Request, res: Response) {
  res.status(201).json({ course: await coursesService.createCourse(actor(req), req.body) });
}

export async function update(req: Request, res: Response) {
  res.json({ course: await coursesService.updateCourse(actor(req), p(req, 'id'), req.body) });
}

export const setStatus = (status: 'PUBLISHED' | 'ARCHIVED' | 'DRAFT') => async (req: Request, res: Response) => {
  res.json({ course: await coursesService.setStatus(actor(req), p(req, 'id'), status) });
};

export async function addModule(req: Request, res: Response) {
  res.status(201).json({ module: await coursesService.addModule(actor(req), p(req, 'id'), req.body) });
}

export async function updateModule(req: Request, res: Response) {
  res.json({ module: await coursesService.updateModule(actor(req), p(req, 'id'), p(req, 'moduleId'), req.body) });
}

export async function deleteModule(req: Request, res: Response) {
  await coursesService.deleteModule(actor(req), p(req, 'id'), p(req, 'moduleId'));
  res.status(204).end();
}

export async function moveModule(req: Request, res: Response) {
  res.json({ modules: await coursesService.moveModule(actor(req), p(req, 'id'), p(req, 'moduleId'), req.body.direction) });
}

export async function assignTrainer(req: Request, res: Response) {
  res.json({ course: await coursesService.assignTrainer(req.user!.id, p(req, 'id'), req.body.trainerId) });
}

export async function enroll(req: Request, res: Response) {
  res.status(201).json({ enrollment: await enrollmentsService.enroll(req.user!.id, p(req, 'id')) });
}

export async function myCourses(req: Request, res: Response) {
  res.json({ enrollments: await enrollmentsService.myCourses(req.user!.id) });
}

export async function saveFeedback(req: Request, res: Response) {
  res.json({ feedback: await feedbackService.saveFeedback(req.user!.id, p(req, 'id'), req.body) });
}

export async function getFeedback(req: Request, res: Response) {
  res.json(await feedbackService.getFeedback(actor(req), p(req, 'id')));
}

export async function completeEnrollment(req: Request, res: Response) {
  res.json({ enrollment: await enrollmentsService.completeEnrollment(actor(req), p(req, 'id'), p(req, 'userId')) });
}
