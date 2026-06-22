import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

async function expectedToken(): Promise<string | null> {
  const secret = process.env.TTW_AUTH_SECRET;
  if (!secret) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("ttw-authenticated"));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function proxy(req: NextRequest) {
  const token = req.cookies.get("ttw_session")?.value;
  if (token && token === (await expectedToken())) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/concierge/:path*",
    "/descobrir/:path*",
    "/api/concierge/:path*",
    "/api/match",
  ],
};
