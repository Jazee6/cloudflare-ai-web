import { expect, test } from "bun:test";
import { createNextConfig } from "./next.config";

test("disables standalone output on Vercel", () => {
  expect(createNextConfig(true).output).toBeUndefined();
});

test("keeps standalone output for self-hosted deployments", () => {
  expect(createNextConfig(false).output).toBe("standalone");
});
