import type { NextConfig } from "next";

export function createNextConfig(isVercel: boolean): NextConfig {
  return {
    // Vercel's adapter assembles the deployment output itself. Combining it
    // with standalone output triggers Next.js issue #96646 during NFT tracing.
    output: isVercel ? undefined : "standalone",
    typedRoutes: true,
    reactCompiler: true,
    experimental: {
      typedEnv: true,
    },
  };
}

export default createNextConfig(process.env.VERCEL === "1");
