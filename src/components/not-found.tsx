import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { useI18n } from "@/hooks/use-i18n";

export default function NotFound() {
  const { t } = useI18n();

  return (
    <Empty className="h-svh">
      <EmptyHeader>
        <EmptyTitle>{t("notFound.title")}</EmptyTitle>
        <EmptyDescription>{t("notFound.description")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button nativeButton={false} render={<Link to="/" />}>
          {t("sidebar.newChat")}
        </Button>
      </EmptyContent>
    </Empty>
  );
}
