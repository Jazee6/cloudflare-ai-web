import type { Metadata } from "next";
import "./globals.css";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import AppSidebar from "@/components/app-sidebar";
import { Toaster } from "sonner";

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
    <html lang="zh">
      <body className="scrollbar-thumb-border scrollbar-track-transparent">
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
      </body>
    </html>
  );
}
