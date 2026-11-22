import { expect, test } from "bun:test";
import { createNextConfig, resolveDeploymentTarget } from "./next.config";

test("disables standalone output on Vercel", () => {
  expect(resolveDeploymentTarget({ VERCEL: "1" })).toBe("vercel");
  expect(createNextConfig("vercel").output).toBeUndefined();
});

test("disables standalone output on Cloudflare Workers", () => {
  expect(resolveDeploymentTarget({ OPENNEXT_CLOUDFLARE: "1" })).toBe("cloudflare");
  expect(resolveDeploymentTarget({ CF_PAGES: "1" })).toBe("cloudflare");
  expect(createNextConfig("cloudflare").output).toBeUndefined();
});

test("keeps standalone output for self-hosted deployments", () => {
  expect(resolveDeploymentTarget({})).toBe("standalone");
  expect(createNextConfig("standalone").output).toBe("standalone");
});

test("disables generated agent rules files", () => {
  expect(createNextConfig("standalone").agentRules).toBe(false);
});
