import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@batac/ui', '@batac/shared'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'r2.batac.gov.ph' },
    ],
  },
};

export default nextConfig;
