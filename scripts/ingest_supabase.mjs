#!/usr/bin/env node
/**
 * Ingestão para o Supabase (pgvector) — caminho de produção.
 *
 * Lê lib/data/activities.json + lib/data/destinations.json, gera embeddings
 * reais (OpenAI text-embedding-3-small) e popula as tabelas `activities` e
 * `destinations`. Idempotente (upsert por id/city).
 *
 * Pré-requisitos (.env):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, OPENAI_API_KEY
 * E o schema aplicado (supabase/schema.sql).
 *
 * Uso:  npm run ingest
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI = process.env.OPENAI_API_KEY;
const MODEL = process.env.EMBEDDING_MODEL || "text-embedding-3-small";

if (!URL || !KEY || !OPENAI) {
  console.error("Faltam variáveis: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, OPENAI_API_KEY");
  process.exit(1);
}

const supabase = createClient(URL, KEY, { auth: { persistSession: false } });
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf-8"));

async function embedBatch(texts) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI}` },
    body: JSON.stringify({ model: MODEL, input: texts }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.data.map((d) => d.embedding);
}

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

async function main() {
  const activities = read("lib/data/activities.json");
  const destinations = read("lib/data/destinations.json");
  console.log(`Atividades: ${activities.length} · Destinos: ${destinations.length}`);

  // 1) destinos (sem embedding)
  const destRows = destinations.map((d) => ({
    city: d.city, country: d.country, activities: d.activities, trips: d.trips,
    theme_scores: d.theme_scores, top_themes: d.top_themes,
    seasonality: d.seasonality, peak_month: d.peak_month,
  }));
  const { error: de } = await supabase.from("destinations").upsert(destRows);
  if (de) throw de;
  console.log("Destinos carregados.");

  // 2) atividades (com embedding, em lotes)
  const batches = chunk(activities, 96);
  let done = 0;
  for (const batch of batches) {
    const embeddings = await embedBatch(batch.map((a) => a.text));
    const rows = batch.map((a, i) => ({
      id: a.id, trip_id: a.trip_id, city: a.city, country: a.country,
      month: a.month, themes: a.themes, description: a.text, embedding: embeddings[i],
    }));
    const { error } = await supabase.from("activities").upsert(rows);
    if (error) throw error;
    done += rows.length;
    process.stdout.write(`\rAtividades: ${done}/${activities.length}`);
  }
  console.log("\nConcluído. Rode ANALYZE activities; para otimizar o índice ANN.");
}

main().catch((e) => { console.error(e); process.exit(1); });
