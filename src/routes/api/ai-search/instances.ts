import { createFileRoute } from "@tanstack/react-router";
import { GET } from "@/server/api/ai-search-instances";

export const Route = createFileRoute("/api/ai-search/instances")({
  server: {
    handlers: {
      GET: () => GET(),
    },
  },
});
