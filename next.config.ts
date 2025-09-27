import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typedRoutes: true,
  experimental: {
    typedEnv: true,
    viewTransition: true,
  },
};

export default nextConfig;
