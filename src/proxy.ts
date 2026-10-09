import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/register"];
/** Open to everyone, signed in or not: the marketing page. */
const MARKETING_PATHS = ["/bienvenue"];

const COOKIE = "etudes_session";
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/**
 * The same check as the server's (signature and expiry), not just the token's shape: a
 * cookie signed with an old secret or tampered with would otherwise send the browser
 * back and forth between /login and the app forever.
 */
async function validToken(token: string): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [userId, expiresAt, signature] = parts;
  if (!Number.isFinite(Number(expiresAt)) || Date.now() > Number(expiresAt)) return false;
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${userId}.${expiresAt}`)));
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get(COOKIE)?.value;
  const hasSession = token ? await validToken(token) : false;

  if (MARKETING_PATHS.includes(pathname)) return NextResponse.next();

  if (!hasSession && !PUBLIC_PATHS.includes(pathname)) {
    // A visitor landing on the bare domain sees what the app is before being asked to sign in.
    const res = NextResponse.redirect(new URL(pathname === "/" ? "/bienvenue" : "/login", request.url));
    // A stale cookie goes away, so the sign-in page is shown instead of bouncing.
    if (token) res.cookies.delete(COOKIE);
    return res;
  }
  if (!hasSession && token) {
    const res = NextResponse.next();
    res.cookies.delete(COOKIE);
    return res;
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
