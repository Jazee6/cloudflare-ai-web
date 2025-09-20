"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Cog, MoreHorizontal, Plus } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
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
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { db, type Session } from "@/lib/db";

interface GroupedSessions {
  type: "today" | "last 7 days" | "last 30 days" | "earlier";
  sessions: Session[];
}

const AppSidebar = () => {
  const { session_id } = useParams();
  const router = useRouter();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [sessionId, setSessionId] = useState("");

  const sessions = useLiveQuery(() =>
    db.session.limit(100).reverse().sortBy("updatedAt"),
  );

  const groupedSessions =
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
    }, [] as GroupedSessions[]) ?? [];

  const handleDelete = async () => {
    await db.transaction("rw", db.session, db.message, async () => {
      await db.session.delete(sessionId);
      await db.message.where("sessionId").equals(sessionId).delete();
    });
    setDeleteConfirmOpen(false);
    router.push("/");
  };

  return (
    <>
      <Sidebar>
        {/*<SidebarHeader />*/}
        <SidebarContent>
          {groupedSessions.map(({ type, sessions }) => (
            <SidebarGroup key={type}>
              <SidebarGroupLabel>{type}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {sessions.map(({ id, name }) => (
                    <SidebarMenuItem key={id}>
                      <SidebarMenuButton asChild isActive={session_id === id}>
                        <Link href={`/c/${id}`}>{name}</Link>
                      </SidebarMenuButton>

                      {session_id === id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <SidebarMenuAction>
                              <MoreHorizontal />
                            </SidebarMenuAction>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent side="right" align="start">
                            <DropdownMenuItem
                              onClick={() => {
                                setDeleteConfirmOpen(true);
                                setSessionId(id);
                              }}
                            >
                              <span className="text-destructive">删除</span>
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
              <Button size="icon" variant="ghost" className="size-8">
                <Cog />
              </Button>
              <Link href="/" className="ml-auto">
                <Button variant="ghost">
                  新对话
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
            <AlertDialogTitle>确认删除对话吗？</AlertDialogTitle>
            <AlertDialogDescription>无法撤销</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>确认</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AppSidebar;
