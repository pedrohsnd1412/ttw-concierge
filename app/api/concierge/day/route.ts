import { NextResponse } from "next/server";
import { pickAlternativeDay } from "@/lib/retrieval";
import { isSupabaseEnabled, pickSupabaseAlternativeDay } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { city, excludeIds, preferences, themes } = await req.json().catch(() => ({}));
  if (!city) return NextResponse.json({ error: "Informe um destino." }, { status: 400 });
  const excluded = Array.isArray(excludeIds) ? excludeIds : [];
  const selectedThemes = Array.isArray(themes) ? themes : [];
  let alt = null;
  if (isSupabaseEnabled()) {
    try {
      alt = await pickSupabaseAlternativeDay(
        city,
        excluded,
        preferences || "",
        selectedThemes
      );
    } catch (error) {
      console.error("Supabase indisponível; usando índice local.", error);
    }
  }
  alt ||= pickAlternativeDay(city, excluded, preferences || "", selectedThemes);
  if (!alt) return NextResponse.json({ error: "Sem mais alternativas para este destino." }, { status: 404 });
  return NextResponse.json(alt);
}
