import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // Pin trace root to webapp/ so Next.js doesn't crawl into the parent monorepo.
  // Vercel sets its own root, so this only matters for local Windows builds.
  outputFileTracingRoot: resolve(__dirname),
};

export default nextConfig;
