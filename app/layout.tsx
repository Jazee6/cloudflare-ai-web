import type { Metadata } from "next";
import "react-medium-image-zoom/dist/styles.css";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import AppSidebar from "@/components/app-sidebar";
import {
  ModelCatalogProvider,
  ModelPreferencesProvider,
} from "@/components/model-catalog-provider";
import { SettingsDialog } from "@/components/settings-dialog";
import { SettingsProvider } from "@/components/settings-provider";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/toast";
import { THEME_COOKIE } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Cloudflare AI Web",
  description: "Cloudflare AI Platform with one-click deployment.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="font-sans">
      <body className="scrollbar-auto scrollbar-thumb-border scrollbar-track-transparent">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          storageKey={THEME_COOKIE}
        >
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

                    {children}
                  </SidebarInset>
                </SidebarProvider>
                <SettingsDialog />
              </SettingsProvider>
            </ModelPreferencesProvider>
          </ModelCatalogProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
