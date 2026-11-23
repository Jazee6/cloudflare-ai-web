import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import {
  ChartColumnIcon,
  DatabaseIcon,
  KeyRoundIcon,
  LayersIcon,
  Settings2Icon,
  Volume2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/hooks/use-i18n";

export const Route = createFileRoute("/settings")({ component: SettingsLayout });

const SECTIONS = [
  { to: "/settings", labelKey: "settings.nav.general", icon: Settings2Icon },
  { to: "/settings/models", labelKey: "settings.nav.models", icon: LayersIcon },
  { to: "/settings/providers", labelKey: "settings.nav.providers", icon: KeyRoundIcon },
  { to: "/settings/voice", labelKey: "settings.nav.voice", icon: Volume2Icon },
  { to: "/settings/usage", labelKey: "settings.nav.usage", icon: ChartColumnIcon },
  { to: "/settings/data", labelKey: "settings.nav.data", icon: DatabaseIcon },
] as const;

function SettingsLayout() {
  const matchRoute = useMatchRoute();
  const { t } = useI18n();

  return (
    <div className="h-svh overflow-y-auto scrollbar-gutter-stable">
      <header className="sticky top-0 z-10 flex h-16 items-center pr-4 pl-14 app-blur">
        <h1 className="text-base font-medium">{t("settings.title")}</h1>
      </header>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pb-10 md:flex-row md:pt-2">
        <nav className="sticky top-16 z-10 md:top-18 -mx-4 flex scrollbar-none gap-1 overflow-x-auto px-4 py-2 max-md:app-blur md:mx-0 md:w-44 md:shrink-0 md:flex-col md:self-start md:p-0">
          {SECTIONS.map((section) => (
            <Button
              key={section.to}
              variant={matchRoute({ to: section.to }) ? "secondary" : "ghost"}
              className="justify-start"
              nativeButton={false}
              render={<Link to={section.to} />}
            >
              <section.icon />
              {t(section.labelKey)}
            </Button>
          ))}
        </nav>
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
