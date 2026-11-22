import { createFileRoute } from "@tanstack/react-router";
import { POST } from "@/server/api/context-document";

export const Route = createFileRoute("/api/context/document")({
  server: {
    handlers: {
      POST: ({ request }) => POST(request),
    },
  },
});
