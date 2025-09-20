import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  if (!process.env.API_PASSWORD) {
    return NextResponse.next();
  }
  const password = request.headers.get("x-app-password");
  if (password !== process.env.API_PASSWORD) {
    return new Response(null, { status: 401 });
  }
}

export const config = {
  matcher: "/api/:path*",
};
