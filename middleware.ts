import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const publicPaths = ["/login", "/registro"];
const authApiPrefix = "/api/auth";
const dashboardPrefix = "/dashboard";

function hasSessionCookie(request: NextRequest): boolean {
  return (
    request.cookies.has("authjs.session-token") ||
    request.cookies.has("__Secure-authjs.session-token") ||
    request.cookies.has("next-auth.session-token") ||
    request.cookies.has("__Secure-next-auth.session-token")
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = publicPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const isAuthApi = pathname.startsWith(authApiPrefix);
  const isCelular = pathname === "/celular";
  const isDashboard = pathname === dashboardPrefix || pathname.startsWith(dashboardPrefix + "/");
  const hasCookie = hasSessionCookie(request);

  if (isAuthApi) return NextResponse.next();

  if (isPublic) {
    return NextResponse.next();
  }

  if (isCelular) {
    if (!hasCookie) {
      return NextResponse.redirect(new URL("/login", request.nextUrl));
    }
    return NextResponse.next();
  }

  if (!hasCookie) {
    return NextResponse.redirect(new URL("/login", request.nextUrl));
  }

  if (isDashboard) {
    const secret = process.env.AUTH_SECRET;
    const token = secret ? await getToken({ req: request, secret }) : null;
    const hasMember = !!token?.member;
    const isAdmin = token?.role === "ADMIN";
    if (!hasMember && !isAdmin) {
      return NextResponse.redirect(new URL("/celular", request.nextUrl));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
