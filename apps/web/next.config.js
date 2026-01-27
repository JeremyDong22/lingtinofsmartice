// Next.js Configuration with PWA Support
// v1.1 - Added static export for Cloudflare Pages deployment

const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@lingtin/types'],
  // Static export for Cloudflare Pages (no server-side code)
  output: 'export',
  // Disable image optimization (not supported in static export)
  images: {
    unoptimized: true,
  },
};

module.exports = withPWA(nextConfig);
