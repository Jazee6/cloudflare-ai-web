import { createFileRoute } from "@tanstack/react-router";
import { POST } from "@/server/api/auth";

export const Route = createFileRoute("/api/auth")({
  server: {
    handlers: {
      POST: ({ request }) => POST(request),
    },
  },
});
