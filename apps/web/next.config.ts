import type { NextConfig } from "next";

const config: NextConfig = {
  experimental: {
    optimizePackageImports: ["pixi.js", "zustand"],
  },
};

export default config;
