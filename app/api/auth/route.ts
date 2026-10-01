import * as v from "valibot";
import { buildCookieHeader, constantTimeCompare, createSessionToken } from "@/lib/auth";
import { parseJsonRequest } from "@/lib/request-limits";

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

  const parsed = await parseJsonRequest(request, authSchema, MAX_AUTH_BODY_BYTES);
  if (!parsed.ok) {
    return parsed.response;
  }

  if (!(await constantTimeCompare(parsed.data.password, password))) {
    return new Response("Invalid password.", { status: 401 });
  }

  const token = await createSessionToken(password);
  return new Response("Authenticated.", {
    status: 200,
    headers: { "Set-Cookie": buildCookieHeader(token) },
  });
}
