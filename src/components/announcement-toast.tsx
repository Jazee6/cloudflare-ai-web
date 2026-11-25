import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useModelCatalogState } from "@/components/model-catalog-provider";
import { toast } from "@/components/ui/toast";
import { useI18n } from "@/hooks/use-i18n";
import {
  ANNOUNCEMENT_DISMISSED_KEY,
  announcementId,
  isSitePath,
  localizeText,
} from "@/lib/announcement";

const readDismissed = () => {
  try {
    return window.localStorage.getItem(ANNOUNCEMENT_DISMISSED_KEY);
  } catch {
    return null;
  }
};

const writeDismissed = (id: string) => {
  try {
    window.localStorage.setItem(ANNOUNCEMENT_DISMISSED_KEY, id);
  } catch {
    // Ignore storage quota or private browsing failures; it shows again on the next visit.
  }
};

/** Shows the deployment's Announcement as a toast that stays until the visitor closes it. */
const AnnouncementToast = () => {
  const { announcement } = useModelCatalogState();
  const { t, locale } = useI18n();
  const router = useRouter();
  const shownRef = useRef<string | null>(null);

  useEffect(() => {
    if (!announcement) {
      return;
    }
    const id = announcementId(announcement);
    if (shownRef.current === id || readDismissed() === id) {
      return;
    }
    shownRef.current = id;
    const toastId = `announcement-${id}`;
    const { description, url } = announcement;
    toast.add({
      id: toastId,
      title: localizeText(announcement.title, locale),
      description: description ? localizeText(description, locale) : undefined,
      timeout: 0,
      onClose: () => writeDismissed(id),
      actionProps: url
        ? {
            children: t("announcement.details"),
            onClick: () => {
              if (isSitePath(url)) {
                router.history.push(url);
              } else {
                window.open(url, "_blank", "noopener");
              }
              toast.close(toastId);
            },
          }
        : undefined,
    });
  }, [announcement, locale, t, router]);

  return null;
};

export default AnnouncementToast;
