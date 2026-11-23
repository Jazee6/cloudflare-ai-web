import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { DatabaseIcon, KeyRoundIcon, LayersIcon, Settings2Icon, Volume2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/settings")({ component: SettingsLayout });

const SECTIONS = [
  { to: "/settings", label: "General", icon: Settings2Icon },
  { to: "/settings/models", label: "Models", icon: LayersIcon },
  { to: "/settings/providers", label: "Providers", icon: KeyRoundIcon },
  { to: "/settings/voice", label: "Voice", icon: Volume2Icon },
  { to: "/settings/data", label: "Data", icon: DatabaseIcon },
] as const;

function SettingsLayout() {
  const matchRoute = useMatchRoute();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pt-16 pb-10">
      <h1 className="text-xl font-semibold">Settings</h1>
      <div className="flex flex-col gap-6 md:flex-row">
        <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 md:w-44 md:shrink-0 md:flex-col">
          {SECTIONS.map((section) => (
            <Button
              key={section.to}
              variant={matchRoute({ to: section.to }) ? "secondary" : "ghost"}
              className="justify-start"
              nativeButton={false}
              render={<Link to={section.to} />}
            >
              <section.icon />
              {section.label}
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
