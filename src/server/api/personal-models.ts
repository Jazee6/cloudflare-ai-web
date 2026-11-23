import { errorResponse } from "@/lib/error-codes";
import { listPersonalModels, resolvePersonalGateway } from "@/lib/personal-gateway";
import { personalCredentialsSchema } from "@/lib/personal-providers";
import { parseJsonRequest } from "@/lib/request-limits";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Lists the models a Personal Provider offers. The response depends on the visitor's credentials,
 * so it is never cached and never shares the public `/api/models` edge cache.
 */
export async function POST(request: Request) {
  const parsed = await parseJsonRequest(request, personalCredentialsSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const resolved = resolvePersonalGateway(parsed.data);
  if (!resolved.ok) {
    return errorResponse(resolved, { status: resolved.status, headers: NO_STORE });
  }

  const result = await listPersonalModels(resolved.gateway, parsed.data.provider);
  if (!result.ok) {
    return errorResponse(result, { status: result.status, headers: NO_STORE });
  }
  return Response.json(
    result.supported
      ? { supported: true, models: result.models }
      : { supported: false, models: [] },
    { headers: NO_STORE },
  );
}
