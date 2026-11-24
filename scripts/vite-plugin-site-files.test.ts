import { expect, test } from "bun:test";
import { precacheFiles, robotsTxt } from "./vite-plugin-site-files.ts";

const chunk = (fileName: string, extra: Record<string, unknown> = {}) => ({
  type: "chunk",
  fileName,
  isEntry: false,
  isDynamicEntry: false,
  facadeModuleId: null,
  imports: [],
  viteMetadata: { importedCss: new Set<string>() },
  ...extra,
});

test("precacheFiles keeps entries and route chunks with their imports, not other lazy chunks", () => {
  const bundle = {
    "assets/main.js": chunk("assets/main.js", { isEntry: true, imports: ["assets/react.js"] }),
    "assets/react.js": chunk("assets/react.js"),
    "assets/chat.js": chunk("assets/chat.js", {
      isDynamicEntry: true,
      facadeModuleId: "/app/src/routes/c.$sessionId.tsx?tsr-split=component",
      imports: ["assets/markdown.js"],
      viteMetadata: { importedCss: new Set(["assets/chat.css"]) },
    }),
    "assets/markdown.js": chunk("assets/markdown.js"),
    "assets/cpp.js": chunk("assets/cpp.js", {
      isDynamicEntry: true,
      facadeModuleId: "/app/node_modules/@shikijs/langs/dist/cpp.mjs",
    }),
    "assets/chat.css": { type: "asset", fileName: "assets/chat.css", source: "" },
  };

  expect(precacheFiles(bundle as never)).toEqual([
    "/assets/chat.css",
    "/assets/chat.js",
    "/assets/main.js",
    "/assets/markdown.js",
    "/assets/react.js",
  ]);
});

test("robotsTxt declares the sitemap only with a site URL", () => {
  expect(robotsTxt(undefined)).not.toContain("Sitemap");
  expect(robotsTxt("https://ai.example.com")).toContain(
    "Sitemap: https://ai.example.com/sitemap.xml",
  );
  expect(robotsTxt(undefined)).toContain("Disallow: /c/");
});
