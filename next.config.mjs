/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: [
      '@prisma/client',
      'prisma',
      'fluent-ffmpeg',
      '@ffmpeg-installer/ffmpeg',
      '@ffprobe-installer/ffprobe',
  ],
};

export default nextConfig;
