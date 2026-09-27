import type { Request, Response } from 'express';
import type { Actor } from './courses.service.js';
import { libraryQuerySchema } from './library.schemas.js';
import * as libraryService from './library.service.js';

const actor = (req: Request) => req.user! as Actor;
const id = (req: Request) => req.params.id as string;

export async function list(req: Request, res: Response) {
  res.json({ items: await libraryService.listItems(actor(req), libraryQuerySchema.parse(req.query)) });
}

export async function get(req: Request, res: Response) {
  res.json({ item: await libraryService.getItem(actor(req), id(req)) });
}

export async function file(req: Request, res: Response) {
  res.json(await libraryService.fileLink(actor(req), id(req)));
}

export async function create(req: Request, res: Response) {
  res.status(201).json({ item: await libraryService.createItem(actor(req), req.body, req.upload!) });
}

export async function update(req: Request, res: Response) {
  res.json({ item: await libraryService.updateItem(actor(req), id(req), req.body) });
}

export async function remove(req: Request, res: Response) {
  await libraryService.deleteItem(actor(req), id(req));
  res.status(204).end();
}
