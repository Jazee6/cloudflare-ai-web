import { createFileRoute } from "@tanstack/react-router";
import { POST } from "@/server/api/image";

export const Route = createFileRoute("/api/image")({
  server: {
    handlers: {
      POST: ({ request }) => POST(request),
    },
  },
});
