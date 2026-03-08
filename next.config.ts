import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Removed output: 'standalone' to prioritize Vercel's native serverless deployment architecture
  serverExternalPackages: ['pdf-parse', 'mammoth', 'youtube-transcript'],
};

export default nextConfig;
