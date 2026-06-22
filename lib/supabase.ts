/**
 * Camada Supabase (produção). É OPCIONAL — o app roda em modo demo com o índice
 * local (lib/retrieval.ts) quando estas variáveis não estão definidas.
 *
 * Caminho de produção:
 *   1. scripts/ingest_supabase.mjs gera embeddings reais e popula a tabela `activities`.
 *   2. A busca usa a RPC `match_activities` (pgvector, cosine) — ver supabase/schema.sql.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  composeIntro,
  getDestination,
  THEME_KEYWORDS,
  vectorizeQuery,
  type ConciergeResult,
} from "./retrieval";

const supabaseSecret = () =>
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

export function isSupabaseEnabled(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && supabaseSecret()
  );
}

let _client: SupabaseClient | null = null;
export function supabaseAdmin(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      supabaseSecret() as string,
      { auth: { persistSession: false } }
    );
  }
  return _client;
}

/** Busca vetorial em produção (pgvector). Requer embedding da query. */
export async function matchActivities(embedding: number[], city: string | null, k = 8) {
  const { data, error } = await supabaseAdmin().rpc("match_activities", {
    query_embedding: embedding,
    match_count: k,
    filter_city: city,
  });
  if (error) throw error;
  return data;
}

type ActivityRow = {
  id: string;
  trip_id: string;
  city: string;
  country: string | null;
  themes: string[] | null;
  description: string;
};

function queryText(preferences: string, themes: string[]) {
  return [preferences, ...themes.map((theme) => THEME_KEYWORDS[theme] || "")]
    .join(" ")
    .trim();
}

function denseEmbedding(text: string): number[] | null {
  if (!text) return null;
  const sparse = vectorizeQuery(text);
  if (!Object.keys(sparse).length) return null;
  const dense = Array<number>(1536).fill(0);
  for (const [index, value] of Object.entries(sparse)) dense[Number(index)] = value;
  return dense;
}

async function activitiesForCity(city: string, limit = 500): Promise<ActivityRow[]> {
  const { data, error } = await supabaseAdmin()
    .from("activities")
    .select("id, trip_id, city, country, themes, description")
    .eq("city", city)
    .limit(limit);
  if (error) throw error;
  return (data || []) as ActivityRow[];
}

async function activityCount(city: string): Promise<number> {
  const { count, error } = await supabaseAdmin()
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("city", city);
  if (error) throw error;
  return count || 0;
}

async function rankedPool(
  city: string,
  preferences: string,
  themes: string[],
  limit: number
): Promise<ActivityRow[]> {
  const embedding = denseEmbedding(queryText(preferences, themes));
  if (!embedding) return activitiesForCity(city, Math.max(limit, 500));
  return (await matchActivities(embedding, city, limit)) as ActivityRow[];
}

export async function buildSupabaseItinerary(
  city: string,
  nDays: number,
  preferences = "",
  themes: string[] = []
): Promise<ConciergeResult | null> {
  const rows = await rankedPool(city, preferences, themes, Math.max(nDays * 8, 40));
  if (!rows.length) return null;

  const seen = new Set<string>();
  const usedThemes = new Set<string>();
  const picked: ConciergeResult["days"] = [];

  for (const row of rows) {
    if (picked.length >= nDays) break;
    const rowThemes = row.themes || [];
    const dedupeKey = row.description.slice(0, 80);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const addsVariety = rowThemes.some((theme) => !usedThemes.has(theme));
    if (!picked.length || addsVariety || rows.length <= nDays) {
      picked.push({
        day: picked.length + 1,
        sourceId: row.id,
        tripId: row.trip_id,
        themes: rowThemes,
        text: row.description,
      });
      rowThemes.forEach((theme) => usedThemes.add(theme));
    }
  }

  for (const row of rows) {
    if (picked.length >= nDays) break;
    if (picked.some((day) => day.sourceId === row.id)) continue;
    picked.push({
      day: picked.length + 1,
      sourceId: row.id,
      tripId: row.trip_id,
      themes: row.themes || [],
      text: row.description,
    });
  }

  const destination = getDestination(city);
  const country = destination?.country || rows[0].country || "";
  return {
    city,
    country,
    days: picked,
    intro: composeIntro(city, country, nDays, [...usedThemes]),
    basis: await activityCount(city),
    preferences: themes,
  };
}

export async function pickSupabaseAlternativeDay(
  city: string,
  excludeIds: string[],
  preferences = "",
  themes: string[] = []
) {
  const excluded = new Set(excludeIds);
  const rows = await rankedPool(city, preferences, themes, 120);
  const candidates = rows.filter((row) => !excluded.has(row.id)).slice(0, 5);
  if (!candidates.length) return null;
  const row = candidates[Math.floor(Math.random() * candidates.length)];
  return {
    sourceId: row.id,
    tripId: row.trip_id,
    themes: row.themes || [],
    text: row.description,
  };
}
