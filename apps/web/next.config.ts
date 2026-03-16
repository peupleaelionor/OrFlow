import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
      { protocol: 'https', hostname: 'img.leboncoin.fr' },
      { protocol: 'https', hostname: '*.ebayimg.com' },
    ],
  },
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'] },
  },
  transpilePackages: ['@orflow/types', '@orflow/gold-pricing'],
};

export default nextConfig;
