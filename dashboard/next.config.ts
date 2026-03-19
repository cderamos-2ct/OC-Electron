import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.8.232"],
};

export default nextConfig;
