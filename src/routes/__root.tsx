import { createRootRoute, HeadContent, Outlet, Scripts, ScriptOnce } from "@tanstack/react-router";
import type { ReactNode } from "react";
import zoomStyles from "react-medium-image-zoom/dist/styles.css?url";
import AppSidebar from "@/components/app-sidebar";
import {
  ModelCatalogProvider,
  ModelPreferencesProvider,
} from "@/components/model-catalog-provider";
import { SettingsDialog } from "@/components/settings-dialog";
import { SettingsProvider } from "@/components/settings-provider";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/toast";
import { useTheme } from "@/hooks/use-theme";
import { themeScript } from "@/lib/theme";
import appStyles from "@/styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Cloudflare AI Web" },
      { name: "description", content: "Cloudflare AI Platform with one-click deployment." },
    ],
    links: [
      { rel: "icon", href: "/icon.svg", type: "image/svg+xml" },
      { rel: "stylesheet", href: zoomStyles },
      { rel: "stylesheet", href: appStyles },
    ],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="font-sans">
      <head>
        <ScriptOnce>{themeScript}</ScriptOnce>
        <HeadContent />
      </head>
      <body className="scrollbar-auto scrollbar-thumb-border scrollbar-track-transparent">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootLayout() {
  // Subscribes to theme changes and follows the system scheme for the whole app.
  useTheme();

  return (
    <>
      <Toaster />

      <ModelCatalogProvider>
        <ModelPreferencesProvider>
          <SettingsProvider>
            <SidebarProvider>
              <AppSidebar />

              <SidebarInset>
                <header className="h-16 flex items-center px-4 absolute">
                  <SidebarTrigger className="-ml-1 z-10" />
                </header>

                <Outlet />
              </SidebarInset>
            </SidebarProvider>
            <SettingsDialog />
          </SettingsProvider>
        </ModelPreferencesProvider>
      </ModelCatalogProvider>
    </>
  );
}
