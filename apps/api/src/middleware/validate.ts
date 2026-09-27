import type { RequestHandler } from 'express';
import type { z } from 'zod';

// Validates req.body against a zod schema and replaces it with the parsed
// (typed, stripped of unknown keys) value. Errors go to the central handler.
export function validateBody(schema: z.ZodType): RequestHandler {
  const handler: RequestHandler = (req, _res, next) => {
    const result = schema.safeParse(req.body ?? {}); // Express 5 leaves body undefined when none is sent
    if (!result.success) return next(result.error);
    req.body = result.data;
    next();
  };
  // Lets the route audit (lib/routeTable.ts) see that this route validates its body.
  return Object.assign(handler, { validatesBody: true });
}
