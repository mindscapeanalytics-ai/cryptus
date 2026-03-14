import { NextRequest, NextResponse } from "next/server";
import { betterFetch } from "@better-fetch/fetch";
import type { auth } from "@/lib/auth";

type Session = typeof auth.$Infer.Session;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/register");

  // Check for session cookies with support for all common variations
  const hasSessionCookie =
    request.cookies.has("better-auth.session_token") ||
    request.cookies.has("__Secure-better-auth.session_token") ||
    request.cookies.has("__secure-better-auth.session_token");

  // Fast path: no cookie + not an auth route → redirect to login
  if (!hasSessionCookie && !isAuthRoute) {
    const url = new URL("/login", request.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // Validate the session if a cookie exists
  let session: Session | null = null;
  if (hasSessionCookie) {
    try {
      // PROD-READY: Use the external URL in production to ensure cookie matching works,
      // but resolve it safely. Force 'https' if we're on a public domain.
      const isProd = process.env.NODE_ENV === "production";
      const protocol = isProd ? "https" : request.nextUrl.protocol.replace(":", "");
      
      // Use the incoming request's host to ensure internal fetches succeed 
      // regardless of environment (local, standalone, or cloud).
      const baseURL = `${protocol}://${request.nextUrl.host}`;

      const { data } = await betterFetch<Session>(
        "/api/auth/get-session",
        {
          baseURL,
          headers: {
            cookie: request.headers.get("cookie") || "",
          },
        },
      );
      session = data;
    } catch (e) {
      console.error(
        "[middleware] Session validation failed:",
        e instanceof Error ? e.message : String(e),
      );
    }
  }

  // Unauthenticated user on a protected page → redirect to login
  if (!session && !isAuthRoute) {
    const url = new URL("/login", request.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // Authenticated user on an auth page → redirect to dashboard
  if (session && isAuthRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes — must be excluded so auth endpoints work)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - assets (images, fonts, etc.)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|assets).*)",
  ],
};
