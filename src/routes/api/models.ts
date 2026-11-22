import { createFileRoute } from "@tanstack/react-router";
import { GET } from "@/server/api/models";

export const Route = createFileRoute("/api/models")({
  server: {
    handlers: {
      GET: ({ request }) => GET(request),
    },
  },
});
