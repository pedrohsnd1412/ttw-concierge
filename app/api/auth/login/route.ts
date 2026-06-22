import { NextResponse } from "next/server";
import { checkCredentials, expectedToken, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));
  if (!checkCredentials(email || "", password || "")) {
    return NextResponse.json({ ok: false, error: "Credenciais inválidas." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, expectedToken(), {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 8,
  });
  return res;
}
