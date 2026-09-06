import type { Metadata } from "next";
import { cookies } from "next/headers";
import "react-medium-image-zoom/dist/styles.css";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toast";
import AppSidebar from "@/components/app-sidebar";
import {
  ModelCatalogProvider,
  ModelPreferencesProvider,
} from "@/components/model-catalog-provider";
import { getModelCatalog } from "@/lib/model-catalog";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Inter } from "next/font/google";
import { THEME_COOKIE, parseThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cloudflare AI Web",
  description: "Cloudflare AI Platform with one-click deployment.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const themePreference = parseThemePreference(cookieStore.get(THEME_COOKIE)?.value);
  const preferences = Object.fromEntries(
    ["CF_AI_MODEL", "CF_AI_MODEL_IMAGE", "CF_AI_SEARCH_ENABLED"].flatMap((key) => {
      const value = cookieStore.get(key)?.value;
      return value ? [[key, value]] : [];
    }),
  ) as Partial<Record<"CF_AI_MODEL" | "CF_AI_MODEL_IMAGE" | "CF_AI_SEARCH_ENABLED", string>>;
  const models = await getModelCatalog();

  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", inter.variable)}>
      <body className="scrollbar-auto scrollbar-thumb-border scrollbar-track-transparent">
        <ThemeProvider
          attribute="class"
          defaultTheme={themePreference}
          enableSystem
          storageKey={THEME_COOKIE}
        >
          <Toaster />

          <ModelCatalogProvider models={models}>
            <ModelPreferencesProvider preferences={preferences}>
              <SidebarProvider>
                <AppSidebar />

                <SidebarInset>
                  <header className="h-16 flex items-center px-4 absolute">
                    <SidebarTrigger className="-ml-1 z-10" />
                  </header>

                  {children}
                </SidebarInset>
              </SidebarProvider>
            </ModelPreferencesProvider>
          </ModelCatalogProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
