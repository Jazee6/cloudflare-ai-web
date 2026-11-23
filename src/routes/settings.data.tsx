import { createFileRoute } from "@tanstack/react-router";
import { DownloadIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import {
  BACKUP_TOO_LARGE_MESSAGE,
  exceedsBackupImportLimit,
  exportConversationHistoryJson,
  importConversationHistory,
  MAX_BACKUP_IMPORT_BYTES,
  triggerBackupDownload,
} from "@/lib/conversation-backup";
import {
  clearAllConversations,
  getStorageStats,
  type LocalStorageStats,
} from "@/lib/conversation-store";

export const Route = createFileRoute("/settings/data")({ component: DataSettings });

function DataSettings() {
  const [stats, setStats] = useState<LocalStorageStats | null>(null);
  const [includeImages, setIncludeImages] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const refreshStats = useCallback(async () => {
    setStats(await getStorageStats());
  }, []);

  useEffect(() => {
    void refreshStats();
  }, [refreshStats]);

  const resetImportInput = () => {
    if (importInputRef.current) {
      importInputRef.current.value = "";
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const json = await exportConversationHistoryJson({ includeImages });
      const dateTag = new Date().toISOString().slice(0, 10);
      await triggerBackupDownload(json, `cloudflare-ai-conversations-${dateTag}.json`);
      if (exceedsBackupImportLimit(json)) {
        toast.add({
          title:
            "Exported, but the backup exceeds the 200 MiB import limit. Export without images to restore it later.",
          type: "warning",
        });
      } else {
        toast.add({ title: "Conversation history exported.", type: "success" });
      }
    } catch {
      toast.add({ title: "Failed to export conversation history.", type: "error" });
    } finally {
      setExporting(false);
    }
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) {
      return;
    }
    setImportError(null);
    if (file.size > MAX_BACKUP_IMPORT_BYTES) {
      setImportError(BACKUP_TOO_LARGE_MESSAGE);
      resetImportInput();
      return;
    }

    setImporting(true);
    try {
      const result = await importConversationHistory(await file.text());
      if (!result.ok) {
        setImportError(result.error);
        toast.add({ title: result.error, type: "error" });
        return;
      }

      toast.add({
        title: `Imported ${result.importedSessions} conversation(s)${
          result.skippedSessions > 0 ? `, skipped ${result.skippedSessions} existing` : ""
        }.`,
        type: "success",
      });
      await refreshStats();
    } catch {
      setImportError("Unable to read the selected backup file.");
    } finally {
      setImporting(false);
      resetImportInput();
    }
  };

  const handleConfirmClear = async () => {
    setClearing(true);
    try {
      await clearAllConversations();
      toast.add({ title: "All conversations cleared.", type: "success" });
      setClearOpen(false);
      await refreshStats();
    } catch {
      toast.add({ title: "Failed to clear local history.", type: "error" });
    } finally {
      setClearing(false);
    }
  };

  return (
    <FieldGroup className="gap-5">
      <Field>
        <FieldLabel>Local Storage</FieldLabel>
        {stats ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-0.5 rounded-lg border p-2.5">
              <span className="text-xs text-muted-foreground">Chats</span>
              <span className="text-base font-medium tabular-nums">{stats.sessionCount}</span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-lg border p-2.5">
              <span className="text-xs text-muted-foreground">Messages</span>
              <span className="text-base font-medium tabular-nums">{stats.messageCount}</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-14 rounded-lg" />
            <Skeleton className="h-14 rounded-lg" />
          </div>
        )}
      </Field>

      <Field>
        <FieldLabel>Conversation Backup</FieldLabel>
        <div className="flex flex-col gap-3 rounded-lg border p-3">
          <Field orientation="horizontal" className="justify-between">
            <FieldLabel htmlFor="settings-export-images">Include images in export</FieldLabel>
            <Switch
              id="settings-export-images"
              checked={includeImages}
              onCheckedChange={setIncludeImages}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={exporting}
              onClick={() => void handleExport()}
            >
              {exporting ? <Spinner /> : <DownloadIcon />}
              Export JSON
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={importing}
              onClick={() => importInputRef.current?.click()}
            >
              {importing ? <Spinner /> : <UploadIcon />}
              Import JSON
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                void handleImportFile(event.target.files?.[0]);
              }}
            />
          </div>
          {importError && <FieldError>{importError}</FieldError>}
        </div>
      </Field>

      <Field>
        <FieldLabel>Danger Zone</FieldLabel>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="destructive" onClick={() => setClearOpen(true)}>
            <Trash2Icon />
            Clear all conversations
          </Button>
        </div>
      </Field>

      <AlertDialog
        open={clearOpen}
        onOpenChange={(open) => {
          if (!open && !clearing) {
            setClearOpen(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all conversations?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes stored local history from this browser and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={clearing}
              onClick={() => void handleConfirmClear()}
            >
              {clearing && <Spinner />}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </FieldGroup>
  );
}
