import type { RequestHandler } from 'express';
import { AppError } from './errors.js';

// A small in-memory fixed-window rate limiter (no dependency). Fine for one API instance,
// which is what the free hosting runs. With several instances each would count separately;
// then a shared store (e.g. the database) would be needed.
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    readonly limit: number,
    readonly windowMs: number,
  ) {}

  /** Records one attempt; returns the seconds to wait if the limit is now exceeded. */
  hit(key: string, now = Date.now()): number | null {
    this.prune(now);
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return null;
    }
    entry.count += 1;
    return entry.count > this.limit ? Math.ceil((entry.resetAt - now) / 1000) : null;
  }

  /** Seconds to wait if `key` is already over the limit (does not count an attempt). */
  blockedFor(key: string, now = Date.now()): number | null {
    const entry = this.hits.get(key);
    return entry && entry.resetAt > now && entry.count >= this.limit ? Math.ceil((entry.resetAt - now) / 1000) : null;
  }

  reset(key: string) {
    this.hits.delete(key);
  }

  clear() {
    this.hits.clear();
  }

  // Forget expired windows so memory stays small.
  private prune(now: number) {
    if (this.hits.size < 5_000) return;
    for (const [key, entry] of this.hits) if (entry.resetAt <= now) this.hits.delete(key);
  }
}

export function tooManyRequests(retryAfterSeconds: number) {
  const minutes = Math.ceil(retryAfterSeconds / 60);
  return new AppError(429, 'TOO_MANY_REQUESTS', `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`, {
    retryAfterSeconds,
  });
}

// Limits requests per client IP address (see `trust proxy` in app.ts for how the real
// client IP is found behind the hosting proxies).
export function limitByIp(limiter: RateLimiter): RequestHandler {
  return (req, res, next) => {
    const wait = limiter.hit(`ip:${req.ip}`);
    if (wait !== null) {
      res.setHeader('Retry-After', String(wait));
      return next(tooManyRequests(wait));
    }
    next();
  };
}

// ── The limiters used by the auth routes ──
const FIFTEEN_MINUTES = 15 * 60 * 1000;
// Generous per IP: in production many users can share the web host's outgoing address.
export const authIpLimiter = new RateLimiter(100, FIFTEEN_MINUTES);
// Strict per account: 10 failed logins, then wait. Cannot be dodged by changing IP.
export const loginFailureLimiter = new RateLimiter(10, FIFTEEN_MINUTES);

export function resetRateLimits() {
  authIpLimiter.clear();
  loginFailureLimiter.clear();
}
