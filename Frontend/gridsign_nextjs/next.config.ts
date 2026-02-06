import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Silence multi-lockfile root inference warning by declaring the project root explicitly for Turbopack
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
