import { NextRequest, NextResponse } from "next/server";
import { betterFetch } from "@better-fetch/fetch";
import type { Session } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  // Determine the best baseURL for internal fetch. 
  // In PaaS like Render, fetching the public HTTPS origin from within the server often fails with SSL errors.
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const host = request.headers.get("host");
  
  // Use localhost for internal communication to avoid SSL packet noise if possible,
  // or use the forwarded protocol to stay consistent with the server's internal listener.
  const port = process.env.PORT || "3000";
  const internalBaseURL = host?.includes("localhost") 
    ? `http://${host}` 
    : `http://127.0.0.1:${port}`;

  const { data: session } = await betterFetch<Session>(
    "/api/auth/get-session",
    {
      baseURL: internalBaseURL,
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
    },
  );

  const isAuthRoute = request.nextUrl.pathname.startsWith("/login") || request.nextUrl.pathname.startsWith("/register");

  if (!session) {
    if (!isAuthRoute) {
      const url = new URL("/login", request.url);
      url.searchParams.set("from", request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
  } else {
    // Redirect authenticated users away from auth pages to dashboard
    if (isAuthRoute) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - assets (images, fonts, etc.)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|assets).*)",
  ],
};
