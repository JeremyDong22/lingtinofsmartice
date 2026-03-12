// Next.js Configuration with PWA Support
// v1.2 - Added Supabase audio bypass for SW to prevent playback cutoff

const defaultRuntimeCaching = require('next-pwa/cache');

const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    // Bypass SW caching for Supabase Storage audio files
    // Without this, the cross-origin 10s timeout cuts off long audio playback
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
      handler: 'NetworkOnly',
    },
    ...defaultRuntimeCaching,
  ],
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
