import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/register"];
/** Open to everyone, signed in or not: the marketing page. */
const MARKETING_PATHS = ["/bienvenue"];

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

  if (MARKETING_PATHS.includes(pathname)) return NextResponse.next();

  if (!hasSession && !PUBLIC_PATHS.includes(pathname)) {
    // A visitor landing on the bare domain sees what the app is before being asked to sign in.
    return NextResponse.redirect(new URL(pathname === "/" ? "/bienvenue" : "/login", request.url));
  }

  if (hasSession && PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL("/today", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // The manifest, the generated icons and the service worker have to stay reachable
  // signed out: iOS fetches the first two when the page is added to the home screen,
  // and the browser fetches sw.js outside any page request. Redirecting them to
  // /login costs the installed app its name, icon, standalone mode and push.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|sw.js|api).*)"],
};
