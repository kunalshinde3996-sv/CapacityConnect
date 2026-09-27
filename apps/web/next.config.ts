import type { NextConfig } from 'next';

// Where the Express API lives. Every request to /api/* on this site is forwarded
// (proxied) to it by Next.js. That keeps the web app and API on ONE site, so the
// HttpOnly refresh cookie is a normal first-party cookie (Safari and other browsers
// block cross-site cookies).
//
// One setting is enough: NEXT_PUBLIC_API_ORIGIN (also used by the browser for file
// uploads and downloads). API_ORIGIN can override the proxy target if the server should
// reach the API through a different address. Both are read at BUILD time.
const apiOrigin = process.env.API_ORIGIN || process.env.NEXT_PUBLIC_API_ORIGIN || 'http://localhost:4000';

// A production build without an API address would proxy to localhost, which fails on
// every request. Stop the build instead of deploying a broken site.
if (process.env.VERCEL_ENV === 'production' && apiOrigin.includes('localhost')) {
  throw new Error('Set NEXT_PUBLIC_API_ORIGIN (the Render API URL) in the Vercel project settings before deploying.');
}

// Basic security headers for every page. (A strict Content-Security-Policy would also
// need nonces for Next.js's inline scripts; out of scope for this prototype.)
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' }, // no embedding in other sites (clickjacking)
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiOrigin}/api/:path*` }];
  },
};

export default nextConfig;
