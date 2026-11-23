import { createFileRoute } from "@tanstack/react-router";
import { POST } from "@/server/api/personal-models";

export const Route = createFileRoute("/api/personal-models")({
  server: {
    handlers: {
      POST: ({ request }) => POST(request),
    },
  },
});
