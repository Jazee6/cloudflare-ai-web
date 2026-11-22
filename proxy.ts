import { type NextRequest, NextResponse } from "next/server";
import { isRequestAuthorized } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  // Allow the auth endpoint and anonymous read-only catalog discovery through.
  if (pathname === "/api/auth" || (pathname === "/api/models" && request.method === "GET")) {
    return NextResponse.next();
  }

  const authorized = await isRequestAuthorized(request);
  if (!authorized) {
    return new Response("Unauthorized", { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
