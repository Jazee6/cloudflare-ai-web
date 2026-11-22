import { isRequestAuthorized } from "@/lib/auth";

/**
 * Access Session gate for `/api/*`. Returns a 401 response when the request must be rejected,
 * or `null` to let it through. Non-API paths are always passed through (they are SPA assets).
 */
export const checkApiAccess = async (request: Request): Promise<Response | null> => {
  const { pathname } = new URL(request.url);
  if (pathname !== "/api" && !pathname.startsWith("/api/")) {
    return null;
  }

  if (!process.env.APP_PASSWORD) {
    return null;
  }

  // Allow the auth endpoint and anonymous read-only catalog discovery through.
  if (pathname === "/api/auth" || (pathname === "/api/models" && request.method === "GET")) {
    return null;
  }

  if (!(await isRequestAuthorized(request))) {
    return new Response("Unauthorized", { status: 401 });
  }

  return null;
};
