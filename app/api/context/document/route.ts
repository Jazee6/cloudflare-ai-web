import { MAX_DOCUMENT_BYTES } from "@/lib/context-attachments";
import { ContextDocumentError, extractDocumentAttachment } from "@/lib/context-document";

const MAX_MULTIPART_OVERHEAD_BYTES = 256 * 1024;

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_DOCUMENT_BYTES + MAX_MULTIPART_OVERHEAD_BYTES
  ) {
    return new Response("Document exceeds the 4 MiB upload limit.", { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
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
