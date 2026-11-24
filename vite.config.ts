import { cloudflare } from "@cloudflare/vite-plugin";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, type PluginOption } from "vite";
import { resolveDeploymentTarget } from "./scripts/deployment-target.ts";
import { resolveSiteUrl } from "./scripts/site-url.ts";
import { siteFiles } from "./scripts/vite-plugin-site-files.ts";

const target = resolveDeploymentTarget();
const siteUrl = resolveSiteUrl();

const serverPlugins = (): PluginOption[] => {
  switch (target) {
    case "cloudflare":
      return [cloudflare({ viteEnvironment: { name: "ssr" } })];
    case "vercel":
      return [nitro({ preset: "vercel" })];
    case "node":
      return [nitro({ preset: "node-server" })];
  }
};

export default defineConfig({
  resolve: { tsconfigPaths: true },
  define: { "import.meta.env.SITE_URL": JSON.stringify(siteUrl ?? "") },
  server: { port: 3000 },
  plugins: [
    ...serverPlugins(),
    tailwindcss(),
    tanstackStart({
      srcDirectory: "src",
      router: { routeFileIgnorePattern: "\\.test\\.tsx?$" },
      spa: {
        enabled: true,
        // Workers' `single-page-application` fallback and static hosts look for index.html.
        prerender: { outputPath: "/index.html" },
      },
    }),
    viteReact(),
    babel({ presets: [reactCompilerPreset()] }),
    siteFiles({ siteUrl }),
  ],
});
