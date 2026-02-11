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
    // Enable Next.js image optimization for faster loading
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
