/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Disable webpack cache in development to prevent ENOENT errors
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false
    }
    return config
  },
  images: {
    // Cache transformed images for 30 days (default is 60s — this alone saves ~99% of re-transformations)
    minimumCacheTTL: 2592000,
    // Fewer width variants = fewer transformations per image
    deviceSizes: [640, 828, 1080, 1920],
    imageSizes: [16, 32, 64, 128, 256],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pzairsoft.ca',
      },
      {
        protocol: 'https',
        hostname: 's3.us-east-1.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.cloud-database.co',
      },
      {
        protocol: 'https',
        hostname: 'assets.knackhq.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
}

export default nextConfig
