import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Plugin } from "vite";

const SERVICE_WORKER_TEMPLATE = new URL("./service-worker.js", import.meta.url);

export const robotsTxt = (siteUrl: string | undefined) =>
  [
    "User-agent: *",
    "Allow: /",
    "Disallow: /c/",
    "Disallow: /settings",
    "Disallow: /api/",
    ...(siteUrl ? ["", `Sitemap: ${siteUrl}/sitemap.xml`] : []),
    "",
  ].join("\n");

export const sitemapXml = (siteUrl: string) =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    `  <url><loc>${siteUrl}/</loc></url>`,
    "</urlset>",
    "",
  ].join("\n");

/**
 * Emits files that depend on the build into the client output, so every deployment target serves
 * them from the site root: `robots.txt`, `sitemap.xml` (only with `SITE_URL`) and the Service
 * Worker stamped with a build ID that changes whenever any client file or the worker changes.
 */
type Bundle = Parameters<NonNullable<Extract<Plugin["generateBundle"], Function>>>[1];

/**
 * The client files the app needs to open any page offline: entry chunks and route chunks (TanStack
 * splits them by `/src/routes/`) with their static imports and CSS. Other lazy chunks, mostly
 * per-language syntax highlighting, are left to runtime caching to keep the first visit small.
 */
export const precacheFiles = (bundle: Bundle) => {
  const files = new Set<string>();
  const visit = (fileName: string) => {
    const output = bundle[fileName];
    if (!output || output.type !== "chunk" || files.has(fileName)) {
      return;
    }
    files.add(fileName);
    for (const css of output.viteMetadata?.importedCss ?? []) {
      files.add(css);
    }
    for (const imported of output.imports) {
      visit(imported);
    }
  };
  for (const output of Object.values(bundle)) {
    if (
      output.type === "chunk" &&
      (output.isEntry || (output.isDynamicEntry && output.facadeModuleId?.includes("/src/routes/")))
    ) {
      visit(output.fileName);
    }
  }
  return [...files].sort().map((fileName) => `/${fileName}`);
};

export function siteFiles({ siteUrl }: { siteUrl: string | undefined }): Plugin {
  return {
    name: "cf-ai-web:site-files",
    apply: "build",
    applyToEnvironment: (environment) => environment.name === "client",
    generateBundle(_options, bundle) {
      const template = readFileSync(SERVICE_WORKER_TEMPLATE, "utf8");
      const hash = createHash("sha256").update(template);
      for (const fileName of Object.keys(bundle).sort()) {
        hash.update(fileName);
      }
      const buildId = hash.digest("hex").slice(0, 12);
      const precache = precacheFiles(bundle);
      const size = (files: string[]) =>
        files.reduce((total, file) => {
          const output = bundle[file.slice(1)];
          const source = output?.type === "chunk" ? output.code : output?.source;
          return (
            total +
            (typeof source === "string" ? Buffer.byteLength(source) : (source?.byteLength ?? 0))
          );
        }, 0);
      const kib = (bytes: number) => `${Math.round(bytes / 1024)} KiB`;
      this.info(
        `Service Worker precaches ${precache.length} files (${kib(size(precache))}) of ${Object.keys(bundle).length} (${kib(size(Object.keys(bundle).map((file) => `/${file}`)))})`,
      );

      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: template
          .replaceAll("__BUILD_ID__", buildId)
          .replace("self.__PRECACHE__ ?? []", JSON.stringify(precache)),
      });
      this.emitFile({ type: "asset", fileName: "robots.txt", source: robotsTxt(siteUrl) });
      if (siteUrl) {
        this.emitFile({ type: "asset", fileName: "sitemap.xml", source: sitemapXml(siteUrl) });
      }
    },
  };
}
