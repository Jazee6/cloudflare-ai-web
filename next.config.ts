import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typedRoutes: true,
  reactCompiler: true,
  experimental: {
    typedEnv: true,
  },
};

export default nextConfig;
