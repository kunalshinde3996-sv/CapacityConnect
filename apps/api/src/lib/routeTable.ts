import type { RequestHandler, Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

export interface RouteInfo {
  method: string;
  path: string;
  auth: boolean; // requireAuth runs before the handler
  roles: string[] | null; // null = any signed-in user (or public)
  validatesBody: boolean; // a zod validateBody() runs before the handler
}

type Tagged = RequestHandler & { allowedRoles?: string[]; validatesBody?: boolean };

interface Layer {
  route?: { path: string; methods: Record<string, boolean>; stack: { handle: Tagged }[] };
  handle: Tagged;
}

// Lists every route with the guards in front of it. Router-level `use(...)` middleware only
// protects routes registered AFTER it, so the stack is walked in order (the announcements
// router relies on this: its public feed comes before `use(requireAuth, ...)`).
export function describeRoutes(mounts: [string, Router][]): RouteInfo[] {
  const routes: RouteInfo[] = [];
  for (const [prefix, router] of mounts) {
    const guards: Tagged[] = [];
    for (const layer of (router as unknown as { stack: Layer[] }).stack) {
      if (!layer.route) {
        guards.push(layer.handle);
        continue;
      }
      const chain = [...guards, ...layer.route.stack.map((s) => s.handle)];
      const roleGuards = chain.filter((h) => h.allowedRoles);
      for (const method of Object.keys(layer.route.methods)) {
        routes.push({
          method: method.toUpperCase(),
          path: `${prefix}${layer.route.path === '/' ? '' : layer.route.path}`,
          auth: chain.includes(requireAuth),
          // Several role guards: a route needs to pass all of them
          roles: roleGuards.length ? roleGuards.map((h) => h.allowedRoles!).reduce((a, b) => a.filter((r) => b.includes(r))) : null,
          validatesBody: chain.some((h) => h.validatesBody),
        });
      }
    }
  }
  return routes;
}
