import { createRootRoute, HeadContent, Outlet, Scripts, ScriptOnce } from "@tanstack/react-router";
import type { ReactNode } from "react";
import zoomStyles from "react-medium-image-zoom/dist/styles.css?url";
import AnnouncementToast from "@/components/announcement-toast";
import AppSidebar from "@/components/app-sidebar";
import {
  ModelCatalogProvider,
  ModelPreferencesProvider,
} from "@/components/model-catalog-provider";
import { ModelLayoutProvider } from "@/components/model-layout-provider";
import { PersonalProvidersProvider } from "@/components/personal-providers-provider";
import { SettingsProvider } from "@/components/settings-provider";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/toast";
import { useTheme } from "@/hooks/use-theme";
import appStyles from "@/styles.css?url";
import { useDocumentLanguage } from "@/hooks/use-i18n";
import { languageScript } from "@/lib/locale";
import { THEME_COLORS, themeScript } from "@/lib/theme";
import {
  OG_IMAGE,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_SHORT_NAME,
  SITE_TITLE,
  SITE_URL,
  siteUrl,
  SOURCE_URL,
} from "@/lib/site";
import NotFound from "@/components/not-found";
import SiteSummary from "@/components/site-summary";
import { useServiceWorker } from "@/hooks/use-service-worker";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: SITE_TITLE },
      { name: "description", content: SITE_DESCRIPTION },
      { name: "theme-color", content: THEME_COLORS.light },
      { name: "apple-mobile-web-app-title", content: SITE_SHORT_NAME },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:title", content: SITE_TITLE },
      { property: "og:description", content: SITE_DESCRIPTION },
      { property: "og:image", content: siteUrl(OG_IMAGE.path) },
      { property: "og:image:width", content: String(OG_IMAGE.width) },
      { property: "og:image:height", content: String(OG_IMAGE.height) },
      ...(SITE_URL ? [{ property: "og:url", content: `${SITE_URL}/` }] : []),
      { name: "twitter:card", content: "summary_large_image" },
      {
        "script:ld+json": {
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: SITE_NAME,
          description: SITE_DESCRIPTION,
          applicationCategory: "UtilitiesApplication",
          operatingSystem: "Any",
          browserRequirements: "Requires JavaScript",
          isAccessibleForFree: true,
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          image: siteUrl(OG_IMAGE.path),
          ...(SITE_URL ? { url: `${SITE_URL}/` } : {}),
          sameAs: [SOURCE_URL],
        },
      },
    ],
    links: [
      { rel: "icon", href: "/icon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      // Every path is served the same prerendered shell; only the home page is indexable.
      ...(SITE_URL ? [{ rel: "canonical", href: `${SITE_URL}/` }] : []),
      { rel: "stylesheet", href: zoomStyles },
      { rel: "stylesheet", href: appStyles },
    ],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
  notFoundComponent: NotFound,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="font-sans">
      <head>
        <ScriptOnce>{themeScript}</ScriptOnce>
        <ScriptOnce>{languageScript}</ScriptOnce>
        <HeadContent />
      </head>
      <body className="scrollbar-auto scrollbar-thumb-border scrollbar-track-transparent">
        <SiteSummary />
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootLayout() {
  // Subscribes to theme changes and follows the system scheme for the whole app.
  useTheme();
  useServiceWorker();
  // Keeps <html lang> on the app language for screen readers, fonts and spell checking.
  useDocumentLanguage();

  return (
    <>
      <Toaster position="top-right" />

      <PersonalProvidersProvider>
        <ModelCatalogProvider>
          <ModelPreferencesProvider>
            <ModelLayoutProvider>
              <AnnouncementToast />
              <SettingsProvider>
                <SidebarProvider>
                  <AppSidebar />

                  <SidebarInset>
                    <header className="absolute z-20 flex h-16 items-center px-4">
                      <SidebarTrigger className="-ml-1" />
                    </header>

                    <Outlet />
                  </SidebarInset>
                </SidebarProvider>
              </SettingsProvider>
            </ModelLayoutProvider>
          </ModelPreferencesProvider>
        </ModelCatalogProvider>
      </PersonalProvidersProvider>
    </>
  );
}
