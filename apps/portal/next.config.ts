import type { NextConfig } from 'next';

type ExtensionAliasWebpackConfig = {
  resolve?: {
    extensionAlias?: Record<string, string[]>;
  };
};

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@batac/ui', '@batac/shared'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'r2.batac.gov.ph' },
    ],
  },
  webpack: (config: ExtensionAliasWebpackConfig) => {
    // The workspace packages are consumed as TypeScript source
    // (`@batac/shared` / `@batac/ui` import each other with ESM `.js`
    // extensions). Next's default resolver does not map `.js` back to `.ts`,
    // so a bundle that imports those packages fails with
    // "Module not found: Can't resolve './errors.js'". Teach webpack to try
    // the TypeScript source first and fall back to the compiled `.js`.
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      ...config.resolve.extensionAlias,
    };
    return config;
  },
};

export default nextConfig;
