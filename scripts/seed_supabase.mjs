#!/usr/bin/env node
/**
 * Carga gratuita do corpus no Supabase usando os vetores TF-IDF já auditados.
 * Os vetores ocupam as primeiras 754 posições do vector(1536); o padding com
 * zeros preserva a similaridade de cosseno e permite troca futura por OpenAI.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const activities = read("lib/data/activities.json");
const destinations = read("lib/data/destinations.json");
const chunks = (items, size) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size)
  );

function denseVector(sparse) {
  const vector = Array(1536).fill(0);
  for (const [index, value] of Object.entries(sparse)) vector[Number(index)] = value;
  return vector;
}

async function main() {
  const destinationRows = destinations.map((destination) => ({
    city: destination.city,
    country: destination.country,
    activities: destination.activities,
    trips: destination.trips,
    theme_scores: destination.theme_scores,
    top_themes: destination.top_themes,
    seasonality: destination.seasonality,
    peak_month: destination.peak_month,
  }));
  const { error: destinationError } = await supabase
    .from("destinations")
    .upsert(destinationRows);
  if (destinationError) throw destinationError;

  let loaded = 0;
  for (const batch of chunks(activities, 25)) {
    const rows = batch.map((activity) => ({
      id: activity.id,
      trip_id: activity.trip_id,
      city: activity.city,
      country: activity.country,
      month: activity.month,
      themes: activity.themes,
      description: activity.text,
      embedding: denseVector(activity.vec),
    }));
    const { error } = await supabase.from("activities").upsert(rows);
    if (error) throw error;
    loaded += rows.length;
    process.stdout.write(`\rAtividades: ${loaded}/${activities.length}`);
  }
  console.log("\nCarga concluída.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
