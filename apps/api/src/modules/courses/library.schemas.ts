import { z } from 'zod';
import type { FileKind } from '../storage/fileTypes.js';

// Which file types each library item type accepts.
export const KINDS_FOR_TYPE: Record<'VIDEO' | 'SLIDES' | 'DOCUMENT', FileKind[]> = {
  VIDEO: ['mp4'],
  SLIDES: ['pdf', 'pptx'],
  DOCUMENT: ['pdf', 'docx'],
};
export const LIBRARY_KINDS: FileKind[] = ['mp4', 'pdf', 'pptx', 'docx'];

// Multipart forms send arrays as a JSON string: '["id1","id2"]'.
const idList = z.preprocess(
  (v) => {
    if (typeof v !== 'string') return v;
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  },
  z.array(z.string().min(1)).min(1, 'Tag at least one competency').max(10),
);
const optionalId = z.preprocess((v) => (v === '' || v === 'null' ? null : v), z.string().min(1).nullable().optional());

export const createLibraryItemSchema = z.object({
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().max(1000).optional(),
  type: z.enum(['VIDEO', 'SLIDES', 'DOCUMENT']),
  competencyIds: idList,
  courseId: optionalId,
  moduleId: optionalId,
});

export const updateLibraryItemSchema = z.object({
  title: z.string().trim().min(3).max(150).optional(),
  description: z.string().trim().max(1000).optional(),
  competencyIds: z.array(z.string().min(1)).min(1).max(10).optional(),
  isPublished: z.boolean().optional(),
  courseId: z.string().min(1).nullable().optional(),
  moduleId: z.string().min(1).nullable().optional(),
});

export const libraryQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  type: z.enum(['VIDEO', 'SLIDES', 'DOCUMENT']).optional(),
  competencyId: z.string().optional(),
  courseId: z.string().optional(),
  mine: z.enum(['true', 'false']).optional(),
});

export type CreateLibraryItemInput = z.infer<typeof createLibraryItemSchema>;
export type UpdateLibraryItemInput = z.infer<typeof updateLibraryItemSchema>;
