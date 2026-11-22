import type { NextConfig } from "next";

export type DeploymentTarget = "vercel" | "cloudflare" | "standalone";

export function resolveDeploymentTarget(
  env: Record<string, string | undefined> = process.env,
): DeploymentTarget {
  if (env.VERCEL === "1") {
    return "vercel";
  }
  if (env.OPENNEXT_CLOUDFLARE === "1" || env.CF_PAGES === "1") {
    return "cloudflare";
  }
  return "standalone";
}

export function createNextConfig(target: DeploymentTarget): NextConfig {
  const output = target === "standalone" ? "standalone" : undefined;

  return {
    // Vercel's adapter assembles the deployment output itself (issue #96646),
    // and OpenNext for Cloudflare Workers controls standalone tracing via NEXT_PRIVATE_STANDALONE.
    ...(output ? { output } : {}),
    typedRoutes: true,
    // Stop `next dev` from writing its agent rules into AGENTS.md / CLAUDE.md.
    agentRules: false,
    reactCompiler: true,
    experimental: {
      typedEnv: true,
    },
  };
}

export default createNextConfig(resolveDeploymentTarget());
