import type { CookieOptions, Request, Response } from 'express';
import { env } from '../../config/env.js';
import { REFRESH_TOKEN_TTL_MS } from '../../lib/tokens.js';
import * as authService from './auth.service.js';

export const REFRESH_COOKIE = 'cc_refresh';

// HttpOnly: JavaScript in the browser cannot read it (protects against XSS token theft).
// Path: only sent to /api/auth, not with every API call.
// In production the web app (Vercel) and the API live on different sites, so the cookie
// needs SameSite=None + Secure to be sent at all. Locally both are on localhost, so Lax works.
const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: env.isProduction ? 'none' : 'lax',
  path: '/api/auth',
};

function sendSession(res: Response, session: authService.Session, status = 200) {
  res.cookie(REFRESH_COOKIE, session.refreshToken, { ...refreshCookieOptions, maxAge: REFRESH_TOKEN_TTL_MS });
  res.status(status).json({ accessToken: session.accessToken, user: session.user });
}

export async function register(req: Request, res: Response) {
  const user = await authService.register(req.body);
  res.status(201).json({
    user,
    message: 'Registration received. You can log in once an administrator approves your account.',
  });
}

export async function login(req: Request, res: Response) {
  sendSession(res, await authService.login(req.body));
}

export async function refresh(req: Request, res: Response) {
  try {
    sendSession(res, await authService.refresh(req.cookies?.[REFRESH_COOKIE]));
  } catch (err) {
    // A dead refresh token is useless: remove it so the browser stops sending it.
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
    throw err;
  }
}

export async function logout(req: Request, res: Response) {
  await authService.logout(req.cookies?.[REFRESH_COOKIE]);
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
  res.status(204).end();
}

export async function me(req: Request, res: Response) {
  res.json({ user: await authService.getMe(req.user!.id) });
}
