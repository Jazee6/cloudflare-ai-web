import { createFileRoute } from "@tanstack/react-router";
import { POST } from "@/server/api/context-url";

export const Route = createFileRoute("/api/context/url")({
  server: {
    handlers: {
      POST: ({ request }) => POST(request),
    },
  },
});
