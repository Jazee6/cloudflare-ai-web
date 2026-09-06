import { type NextRequest, NextResponse } from "next/server";
import { isRequestAuthorized } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) {
    return NextResponse.next();
  }

  // Allow the auth endpoint through
  if (request.nextUrl.pathname === "/api/auth") {
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
