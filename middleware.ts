import { NextRequest, NextResponse } from "next/server";
import { betterFetch } from "@better-fetch/fetch";
import type { auth } from "@/lib/auth";
import { AUTH_CONFIG } from "@/lib/config";

type Session = typeof auth.$Infer.Session;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow static/public assets so PWA files and icons are reachable before auth.
  const isStaticAsset =
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/logo/") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.json" ||
    pathname === "/robots.txt" ||
    pathname === "/sw.js" ||
    pathname.startsWith("/workbox-") ||
    pathname.startsWith("/worker-") ||
    /\.[a-z0-9]+$/i.test(pathname);

  if (isStaticAsset) {
    return NextResponse.next();
  }

  const publicPrefixes = ["/login", "/register", "/about", "/services", "/subscription"];
  const isPublicRoute =
    pathname === "/" ||
    publicPrefixes.some((prefix) => pathname.startsWith(prefix));

  // Check for session cookies with support for all common variations
  const hasSessionCookie =
    request.cookies.has("better-auth.session_token") ||
    request.cookies.has("__Secure-better-auth.session_token") ||
    request.cookies.has("__secure-better-auth.session_token");

  // Fast path: no cookie + not a public route → redirect to login
  if (!hasSessionCookie && !isPublicRoute) {
    const url = new URL("/login", request.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // Validate the session if a cookie exists
  let session: Session | null = null;
  if (hasSessionCookie) {
    try {
      // Better detection of the base URL: Use the request's protocol and host.
      const baseURL = `${request.nextUrl.protocol}//${request.nextUrl.host}`;

      const { data, error: fetchError } = await betterFetch<Session>(
        "/api/auth/get-session",
        {
          baseURL,
          headers: {
            cookie: request.headers.get("cookie") || "",
          },
        },
      );

      if (fetchError) {
        console.warn(
          "[middleware] Session fetch rejected:",
          fetchError.statusText || "Unauthorized/Network Error"
        );
      }
      
      session = data;
    } catch (e) {
      console.error(
        "[middleware] Critical session validation failure:",
        e instanceof Error ? e.message : String(e),
      );
    }
  }

  // Unauthenticated user on a protected page → redirect to login
  if (!session && !isPublicRoute) {
    const url = new URL("/login", request.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // Authenticated user on an auth page → redirect to terminal
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register");
  if (session && isAuthPage) {
    return NextResponse.redirect(new URL("/terminal", request.url));
  }

  // Owner-only route guard for admin panel
  if (session && pathname.startsWith("/admin")) {
    const isOwner =
      session.user.email === AUTH_CONFIG.SUPER_ADMIN_EMAIL ||
      session.user.role === "owner";

    if (!isOwner) {
      return NextResponse.redirect(new URL("/terminal", request.url));
    }
  }

  // Subscription enforcement for product routes
  const needsSubscription = pathname.startsWith("/terminal") || pathname.startsWith("/guide");
  const ownerBypass =
    session?.user?.email === AUTH_CONFIG.SUPER_ADMIN_EMAIL ||
    session?.user?.role === "owner";

  if (session && needsSubscription && !ownerBypass) {
    try {
      const baseURL = `${request.nextUrl.protocol}//${request.nextUrl.host}`;
      const { data } = await betterFetch<{ hasActiveSubscription?: boolean }>(
        "/api/subscription/status",
        {
          baseURL,
          headers: {
            cookie: request.headers.get("cookie") || "",
          },
        },
      );

      if (!data?.hasActiveSubscription) {
        const url = new URL("/subscription", request.url);
        url.searchParams.set("required", "1");
        return NextResponse.redirect(url);
      }
    } catch (error) {
      console.warn("[middleware] subscription check failed:", error);
      const url = new URL("/subscription", request.url);
      url.searchParams.set("required", "1");
      return NextResponse.redirect(url);
    }
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
     * - metadata and PWA assets (manifest, sw, robots, favicon)
     * - any file with an extension (public assets: images, icons, js, css, etc.)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|manifest.json|sw.js|.*\\..*).*)",
  ],
};
