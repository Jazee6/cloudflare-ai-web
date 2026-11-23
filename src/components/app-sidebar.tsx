import { useLiveQuery } from "dexie-react-hooks";
import { MoreHorizontal, Plus, SettingsIcon } from "lucide-react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import LoadingIndicator from "@/components/loading-indicator";
import { useSettings } from "@/components/settings-provider";
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
import { Spinner } from "@/components/ui/spinner";
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
import { deleteConversation, listRecentSessions } from "@/lib/conversation-store";
import type { Session } from "@/lib/db";

interface GroupedSessions {
  type: "today" | "last 7 days" | "last 30 days" | "earlier";
  sessions: Session[];
}

const AppSidebar = () => {
  const sessionId = useParams({ strict: false, select: (params) => params.sessionId });
  const navigate = useNavigate();
  const { setSettingsOpen } = useSettings();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

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
    if (!deleteTarget || deleting) {
      return;
    }
    setDeleting(true);
    try {
      await deleteConversation(deleteTarget);
      setDeleteConfirmOpen(false);
      void navigate({ to: "/" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Sidebar>
        <SidebarContent className="scroll-fade-y scrollbar-auto scrollbar-thumb-border scrollbar-track-transparent">
          {groupedSessions.map(({ type, sessions }) => (
            <SidebarGroup key={type}>
              <SidebarGroupLabel>{type}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {sessions.map(({ id, name }) => (
                    <SidebarMenuItem key={id}>
                      <SidebarMenuButton
                        render={<Link to="/c/$sessionId" params={{ sessionId: id }} />}
                        isActive={sessionId === id}
                      >
                        {name}
                        <LoadingIndicator pathname={`/c/${id}`} className="ml-auto" />
                      </SidebarMenuButton>

                      {sessionId === id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<SidebarMenuAction />}>
                            <MoreHorizontal />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent side="right" align="start">
                            <DropdownMenuItem
                              onClick={() => {
                                setDeleteConfirmOpen(true);
                                setDeleteTarget(id);
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
            <SidebarMenuItem className="flex items-center gap-1">
              <ThemeSwitcher />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-8"
                aria-label="Settings"
                onClick={() => setSettingsOpen(true)}
              >
                <SettingsIcon />
              </Button>

              <Link to="/" className="ml-auto">
                <Button variant="ghost">
                  New Chat
                  <Plus />
                </Button>
              </Link>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <AlertDialog
        open={deleteConfirmOpen}
        onOpenChange={(open) => {
          if (!deleting) {
            setDeleteConfirmOpen(open);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this session?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={() => void handleDelete()}>
              {deleting && <Spinner />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AppSidebar;
