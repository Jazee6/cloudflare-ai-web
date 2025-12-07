import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import AppSidebar from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export const metadata: Metadata = {
  title: "Cloudflare AI Web",
  description: "Cloudflare AI Platform with one-click deployment.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // const cookieStore = await cookies();
  // const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="scrollbar-thumb-border scrollbar-track-transparent">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Toaster position="top-center" richColors />

          <SidebarProvider>
            <AppSidebar />

            <SidebarInset>
              <header className="h-16 flex items-center px-4 absolute">
                <SidebarTrigger className="-ml-1 z-10" />
              </header>

              {children}
            </SidebarInset>
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
