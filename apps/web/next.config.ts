import type { NextConfig } from 'next';

// Where the Express API lives. The browser never calls it directly: every
// request to /api/* on this site is forwarded (proxied) to it by Next.js.
// That keeps the web app and API on ONE site, so the HttpOnly refresh cookie is a
// normal first-party cookie (Safari and other browsers block cross-site cookies).
// Read at build time: set API_ORIGIN in Vercel before deploying.
const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiOrigin}/api/:path*` }];
  },
};

export default nextConfig;
