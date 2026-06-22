import { NextResponse } from "next/server";
import { discoverDestinations } from "@/lib/retrieval";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { preferences, themes } = await req.json().catch(() => ({}));
  const t = Array.isArray(themes) ? themes : [];
  if (!preferences && !t.length)
    return NextResponse.json({ error: "Descreva os gostos do cliente ou selecione temas." }, { status: 400 });
  const results = discoverDestinations(preferences || "", t, 4);
  return NextResponse.json({ results });
}
