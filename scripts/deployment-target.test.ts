import { expect, test } from "bun:test";
import { resolveDeploymentTarget } from "./deployment-target";

test("detects Vercel builds", () => {
  expect(resolveDeploymentTarget({ VERCEL: "1" })).toBe("vercel");
});

test("detects Cloudflare builds", () => {
  expect(resolveDeploymentTarget({ WORKERS_CI: "1" })).toBe("cloudflare");
  expect(resolveDeploymentTarget({ CF_PAGES: "1" })).toBe("cloudflare");
});

test("defaults to the self-hosted Node server", () => {
  expect(resolveDeploymentTarget({})).toBe("node");
});

test("DEPLOY_TARGET overrides detection and rejects unknown values", () => {
  expect(resolveDeploymentTarget({ DEPLOY_TARGET: "cloudflare", VERCEL: "1" })).toBe("cloudflare");
  expect(resolveDeploymentTarget({ DEPLOY_TARGET: "Node" })).toBe("node");
  expect(() => resolveDeploymentTarget({ DEPLOY_TARGET: "netlify" })).toThrow();
});
