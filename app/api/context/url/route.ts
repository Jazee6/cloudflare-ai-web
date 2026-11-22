import * as v from "valibot";
import { ContextDocumentError } from "@/lib/context-document";
import { ContextUrlError, extractWebpageAttachment } from "@/lib/context-url";
import { parseJsonRequest } from "@/lib/request-limits";
import { SsrfError } from "@/lib/ssrf";

const urlRequestSchema = v.object({
  url: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(2048)),
  mode: v.optional(v.picklist(["auto", "zero-quota", "browser"])),
});

export async function POST(request: Request) {
  const parsed = await parseJsonRequest(request, urlRequestSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const attachment = await extractWebpageAttachment(parsed.data);
    return Response.json({ attachment });
  } catch (error) {
    if (
      error instanceof SsrfError ||
      error instanceof ContextUrlError ||
      error instanceof ContextDocumentError
    ) {
      return new Response(error.message, { status: error.status });
    }
    console.error("Unexpected URL extraction error:", error);
    return new Response("Failed to extract webpage content.", { status: 500 });
  }
}
