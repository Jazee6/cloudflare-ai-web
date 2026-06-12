import { type NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  if (!process.env.APP_PASSWORD) {
    return NextResponse.next();
  }
  const password = request.headers.get("Authorization");
  if (password !== process.env.APP_PASSWORD) {
    return new Response("Unauthorized", { status: 401 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
