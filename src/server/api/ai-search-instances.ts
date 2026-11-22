import { getConfiguredKnowledgeBases } from "@/lib/ai-search";

export async function GET() {
  return Response.json(
    { instances: getConfiguredKnowledgeBases() },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}
