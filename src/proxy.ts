import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/register"];

function verifyTokenSimple(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const expiresAt = Number(parts[1]);
  if (Number.isNaN(expiresAt) || Date.now() > expiresAt) return false;
  return true;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get("etudes_session")?.value;
  const hasSession = token ? verifyTokenSimple(token) : false;

  if (!hasSession && !PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (hasSession && PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL("/today", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
