import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
const config: NextConfig = {
  experimental: {
    optimizePackageImports: ["pixi.js", "zustand"],
  },
};

export default config;
