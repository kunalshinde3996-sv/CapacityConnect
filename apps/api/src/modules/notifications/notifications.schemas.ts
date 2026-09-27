import { z } from 'zod';

// Links may only be in-app paths ("/courses/...") or https URLs: never "javascript:" etc.,
// which would run code when clicked.
const safeLink = z
  .string()
  .trim()
  .max(500)
  .refine((v) => (v.startsWith('/') && !v.startsWith('//')) || /^https:\/\/[^\s]+$/.test(v), 'Use an in-app path like /courses or an https:// link');

export const announcementSchema = z.object({
  type: z.enum(['NOTICE', 'ACHIEVEMENT', 'NEW_CONTENT']),
  title: z.string().trim().min(3).max(150),
  body: z.string().trim().min(10).max(4000),
  linkUrl: safeLink.nullable().optional(),
});
export type AnnouncementInput = z.infer<typeof announcementSchema>;
