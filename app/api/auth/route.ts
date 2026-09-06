import * as v from "valibot";
import { buildCookieHeader, constantTimeCompare, createSessionToken } from "@/lib/auth";
import { readRequestBody } from "@/lib/request-limits";

const MAX_AUTH_BODY_BYTES = 1024;

const authSchema = v.object({
  password: v.pipe(v.string(), v.minLength(1)),
});

const isCrossSiteRequest = (request: Request) => {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return true;
  }

  const origin = request.headers.get("origin");
  return origin !== null && origin !== new URL(request.url).origin;
};

export async function POST(request: Request) {
  const password = process.env.APP_PASSWORD;

  if (!password) {
    return new Response("Authentication is not required for this deployment.", { status: 200 });
  }
  if (isCrossSiteRequest(request)) {
    return new Response("Forbidden", { status: 403 });
  }

  const bodyResult = await readRequestBody(request, MAX_AUTH_BODY_BYTES);
  if (!bodyResult.ok) {
    return new Response(bodyResult.message, { status: bodyResult.status });
  }

  let body: unknown;
  try {
    body = JSON.parse(bodyResult.text);
  } catch {
    return new Response("Invalid request data", { status: 400 });
  }

  const parsed = v.safeParse(authSchema, body);
  if (!parsed.success) {
    return new Response("Invalid request data", { status: 400 });
  }

  if (!(await constantTimeCompare(parsed.output.password, password))) {
    return new Response("Invalid password.", { status: 401 });
  }

  const token = await createSessionToken(password);
  return new Response("Authenticated.", {
    status: 200,
    headers: { "Set-Cookie": buildCookieHeader(token) },
  });
}
