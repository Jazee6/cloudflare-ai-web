export type DeploymentTarget = "cloudflare" | "vercel" | "node";

const TARGETS: readonly DeploymentTarget[] = ["cloudflare", "vercel", "node"];

/**
 * Picks the build target. `DEPLOY_TARGET` wins; otherwise Vercel and Cloudflare CI environments
 * are detected automatically and everything else builds the self-hosted Node server.
 */
export function resolveDeploymentTarget(
  env: Record<string, string | undefined> = process.env,
): DeploymentTarget {
  const explicit = env.DEPLOY_TARGET?.trim().toLowerCase();
  if (explicit) {
    if (!TARGETS.includes(explicit as DeploymentTarget)) {
      throw new Error(`Unknown DEPLOY_TARGET "${env.DEPLOY_TARGET}". Use ${TARGETS.join(", ")}.`);
    }
    return explicit as DeploymentTarget;
  }
  if (env.VERCEL === "1") {
    return "vercel";
  }
  if (env.WORKERS_CI === "1" || env.CF_PAGES === "1") {
    return "cloudflare";
  }
  return "node";
}
