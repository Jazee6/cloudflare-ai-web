"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { ImageIcon, MoreHorizontal, Plus } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import LoadingIndicator from "@/components/loading-indicator";
import { ThemeSwitcher } from "@/components/theme-switcher";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  clearImageHistory,
  deleteConversation,
  listRecentSessions,
} from "@/lib/conversation-store";
import type { Session } from "@/lib/db";

interface GroupedSessions {
  type: "today" | "last 7 days" | "last 30 days" | "earlier";
  sessions: Session[];
}

const AppSidebar = () => {
  const { session_id } = useParams();
  const router = useRouter();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<
    { kind: "conversation"; sessionId: string } | { kind: "image-history" } | null
  >(null);
  const pathname = usePathname();

  const sessions = useLiveQuery(listRecentSessions);

  const groupedSessions = useMemo(
    () =>
      sessions?.reduce((groups, session) => {
        const now = new Date();
        const updatedAt = new Date(session.updatedAt);
        const diffTime = now.getTime() - updatedAt.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        let groupType: GroupedSessions["type"];
        if (diffDays === 0) {
          groupType = "today";
        } else if (diffDays <= 7) {
          groupType = "last 7 days";
        } else if (diffDays <= 30) {
          groupType = "last 30 days";
        } else {
          groupType = "earlier";
        }

        const group = groups.find((g) => g.type === groupType);
        if (group) {
          group.sessions.push(session);
        } else {
          groups.push({ type: groupType, sessions: [session] });
        }
        return groups;
      }, [] as GroupedSessions[]) ?? [],
    [sessions],
  );

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }
    if (deleteTarget.kind === "image-history") {
      await clearImageHistory();
      setDeleteConfirmOpen(false);
      return;
    }
    await deleteConversation(deleteTarget.sessionId);
    setDeleteConfirmOpen(false);
    router.push("/");
  };

  return (
    <>
      <Sidebar>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link href="/image" prefetch={false} />}
                isActive={pathname === "/image"}
              >
                <ImageIcon />
                Image
                <LoadingIndicator className="ml-auto" />
              </SidebarMenuButton>

              {pathname === "/image" && (
                <DropdownMenu>
                  <DropdownMenuTrigger render={<SidebarMenuAction />}>
                    <MoreHorizontal />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="start">
                    <DropdownMenuItem
                      onClick={() => {
                        setDeleteConfirmOpen(true);
                        setDeleteTarget({ kind: "image-history" });
                      }}
                    >
                      <span className="text-destructive">Delete</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent className="scrollbar-auto scrollbar-thumb-border scrollbar-track-transparent">
          {groupedSessions.map(({ type, sessions }) => (
            <SidebarGroup key={type}>
              <SidebarGroupLabel>{type}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {sessions.map(({ id, name }) => (
                    <SidebarMenuItem key={id}>
                      <SidebarMenuButton
                        render={<Link href={`/c/${id}`} prefetch={false} />}
                        isActive={session_id === id}
                      >
                        {name}
                        <LoadingIndicator className="ml-auto" />
                      </SidebarMenuButton>

                      {session_id === id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<SidebarMenuAction />}>
                            <MoreHorizontal />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent side="right" align="start">
                            <DropdownMenuItem
                              onClick={() => {
                                setDeleteConfirmOpen(true);
                                setDeleteTarget({ kind: "conversation", sessionId: id });
                              }}
                            >
                              <span className="text-destructive">Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem className="flex items-center">
              <ThemeSwitcher />

              <Link href="/" prefetch={false} className="ml-auto">
                <Button variant="ghost">
                  New Chat
                  <Plus />
                </Button>
              </Link>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this session?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AppSidebar;
