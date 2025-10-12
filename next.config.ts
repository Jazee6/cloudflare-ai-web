import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typedRoutes: true,
  experimental: {
    typedEnv: true,
    viewTransition: true,
    reactCompiler: true,
  },
};

export default nextConfig;
