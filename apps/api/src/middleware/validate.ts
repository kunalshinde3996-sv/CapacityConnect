import type { RequestHandler } from 'express';
import type { z } from 'zod';

// Validates req.body against a zod schema and replaces it with the parsed
// (typed, stripped of unknown keys) value. Errors go to the central handler.
export function validateBody(schema: z.ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return next(result.error);
    req.body = result.data;
    next();
  };
}
