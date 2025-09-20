import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  experimental: {
    typedEnv: true,
    viewTransition: true,
  },
};

export default nextConfig;
