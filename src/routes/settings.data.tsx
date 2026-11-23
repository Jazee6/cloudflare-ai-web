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
import { useI18n } from "@/hooks/use-i18n";

export const Route = createFileRoute("/settings/data")({ component: DataSettings });

function DataSettings() {
  const { t, tc } = useI18n();
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
          title: t("settings.data.exportTooLarge"),
          type: "warning",
        });
      } else {
        toast.add({ title: t("settings.data.exported"), type: "success" });
      }
    } catch {
      toast.add({ title: t("settings.data.exportFailed"), type: "error" });
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
      setImportError(t(BACKUP_TOO_LARGE_MESSAGE));
      resetImportInput();
      return;
    }

    setImporting(true);
    try {
      const result = await importConversationHistory(await file.text());
      if (!result.ok) {
        setImportError(t(result.error));
        toast.add({ title: t(result.error), type: "error" });
        return;
      }

      toast.add({
        title:
          result.skippedSessions > 0
            ? t("settings.data.importedWithSkipped", {
                imported: tc("settings.data.conversations", result.importedSessions),
                skipped: result.skippedSessions,
              })
            : t("settings.data.imported", {
                imported: tc("settings.data.conversations", result.importedSessions),
              }),
        type: "success",
      });
      await refreshStats();
    } catch {
      setImportError(t("settings.data.readFailed"));
    } finally {
      setImporting(false);
      resetImportInput();
    }
  };

  const handleConfirmClear = async () => {
    setClearing(true);
    try {
      await clearAllConversations();
      toast.add({ title: t("settings.data.cleared"), type: "success" });
      setClearOpen(false);
      await refreshStats();
    } catch {
      toast.add({ title: t("settings.data.clearFailed"), type: "error" });
    } finally {
      setClearing(false);
    }
  };

  return (
    <FieldGroup className="gap-5">
      <Field>
        <FieldLabel>{t("settings.data.localStorage")}</FieldLabel>
        {stats ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-0.5 rounded-lg border p-2.5">
              <span className="text-xs text-muted-foreground">{t("settings.data.chats")}</span>
              <span className="text-base font-medium tabular-nums">{stats.sessionCount}</span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-lg border p-2.5">
              <span className="text-xs text-muted-foreground">{t("settings.data.messages")}</span>
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
        <FieldLabel>{t("settings.data.backup")}</FieldLabel>
        <div className="flex flex-col gap-3 rounded-lg border p-3">
          <Field orientation="horizontal" className="justify-between">
            <FieldLabel htmlFor="settings-export-images">
              {t("settings.data.includeImages")}
            </FieldLabel>
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
              {t("settings.data.export")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={importing}
              onClick={() => importInputRef.current?.click()}
            >
              {importing ? <Spinner /> : <UploadIcon />}
              {t("settings.data.import")}
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
        <FieldLabel>{t("settings.data.dangerZone")}</FieldLabel>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="destructive" onClick={() => setClearOpen(true)}>
            <Trash2Icon />
            {t("settings.data.clearAll")}
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
            <AlertDialogTitle>{t("settings.data.clearTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("settings.data.clearDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={clearing}
              onClick={() => void handleConfirmClear()}
            >
              {clearing && <Spinner />}
              {t("common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </FieldGroup>
  );
}
