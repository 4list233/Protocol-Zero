/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    // Enable Next.js image optimization for faster loading
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pzairsoft.ca',
      },
    ],
  },
}

export default nextConfig
