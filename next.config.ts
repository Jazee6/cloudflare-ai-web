import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  experimental: {
    typedEnv: true,
    viewTransition: true,
    reactCompiler: true,
  },
};

export default nextConfig;
