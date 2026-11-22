import { MAX_DOCUMENT_BYTES } from "@/lib/context-attachments";
import { ContextDocumentError, extractDocumentAttachment } from "@/lib/context-document";
import { readRequestBytes } from "@/lib/request-limits";

const MAX_MULTIPART_OVERHEAD_BYTES = 256 * 1024;

export async function POST(request: Request) {
  const bodyResult = await readRequestBytes(
    request,
    MAX_DOCUMENT_BYTES + MAX_MULTIPART_OVERHEAD_BYTES,
  );
  if (!bodyResult.ok) {
    return new Response("Document exceeds the 4 MiB upload limit.", { status: 413 });
  }

  let formData: FormData;
  try {
    const headers = new Headers();
    const contentType = request.headers.get("content-type");
    if (contentType) {
      headers.set("content-type", contentType);
    }
    formData = await new Request(request.url, {
      method: "POST",
      headers,
      body: new Uint8Array(bodyResult.bytes),
    }).formData();
  } catch {
    return new Response("Invalid multipart form data.", { status: 400 });
  }

  const entry = formData.get("file");
  if (!(entry instanceof File)) {
    return new Response("Missing document file.", { status: 400 });
  }

  try {
    const attachment = await extractDocumentAttachment(entry);
    return Response.json({ attachment });
  } catch (error) {
    if (error instanceof ContextDocumentError) {
      return new Response(error.message, { status: error.status });
    }
    console.error("Unexpected document extraction error:", error);
    return new Response("Failed to extract document content.", { status: 500 });
  }
}
