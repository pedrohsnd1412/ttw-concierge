import { NextResponse } from "next/server";
import { buildItinerary } from "@/lib/retrieval";
import { buildSupabaseItinerary, isSupabaseEnabled } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { city, days, preferences, themes } = await req.json().catch(() => ({}));
  if (!city) return NextResponse.json({ error: "Informe um destino." }, { status: 400 });
  const n = Math.min(Math.max(Number(days) || 3, 1), 7);
  const selectedThemes = Array.isArray(themes) ? themes : [];
  let result = null;
  if (isSupabaseEnabled()) {
    try {
      result = await buildSupabaseItinerary(city, n, preferences || "", selectedThemes);
    } catch (error) {
      console.error("Supabase indisponível; usando índice local.", error);
    }
  }
  result ||= buildItinerary(city, n, preferences || "", selectedThemes);
  if (!result) return NextResponse.json({ error: "Destino sem histórico na base." }, { status: 404 });
  return NextResponse.json(result);
}
