/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: [
      '@prisma/client',
      'prisma',
      'fluent-ffmpeg',
      '@ffmpeg-installer/ffmpeg',
      '@ffprobe-installer/ffprobe',
    ],
  },
};

export default nextConfig;
