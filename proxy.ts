import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = ["/login", "/registro"];
const authApiPrefix = "/api/auth";

function hasSessionCookie(request: NextRequest): boolean {
  return (
    request.cookies.has("authjs.session-token") ||
    request.cookies.has("__Secure-authjs.session-token") ||
    request.cookies.has("next-auth.session-token") ||
    request.cookies.has("__Secure-next-auth.session-token")
  );
}

/**
 * Auth gate:
 * - Only checks if a session cookie exists
 * - Fine-grained authorization is handled in Server Components via `auth()`
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = publicPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const isAuthApi = pathname.startsWith(authApiPrefix);
  const hasCookie = hasSessionCookie(request);

  if (isAuthApi || isPublic) return NextResponse.next();

  if (!hasCookie) {
    return NextResponse.redirect(new URL("/login", request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

