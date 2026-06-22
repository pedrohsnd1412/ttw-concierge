/**
 * Motor de retrieval — modo demo (índice local em JSON).
 *
 * Espelha a lógica de vetorização do pipeline Python (TF-IDF) para que a busca
 * por similaridade rode sem dependências externas. Quando o Supabase estiver
 * configurado, lib/supabase.ts assume o caminho de produção (pgvector).
 */
import activitiesRaw from "./data/activities.json";
import destinationsRaw from "./data/destinations.json";
import vocabRaw from "./data/vocab.json";

export type Activity = {
  id: string; trip_id: string; city: string; country: string;
  month: number | null; themes: string[]; text: string; vec: Record<string, number>;
};
export type Destination = {
  city: string; country: string; activities: number; trips: number;
  theme_scores: Record<string, number>; top_themes: string[];
  seasonality: number[]; peak_month: string | null;
  centroid: Record<string, number>; samples: string[];
};

const activities = activitiesRaw as unknown as Activity[];
const destinations = destinationsRaw as unknown as Destination[];
const vocab = (vocabRaw as any).vocab as Record<string, number>;
const idf = (vocabRaw as any).idf as Record<string, number>;

export const THEME_KEYWORDS: Record<string, string> = {
  "Gastronomia": "jantar restaurante gastronomia degustacao vinho culinaria mercado",
  "Arte & Museus": "museu galeria arte exposicao obras pintura",
  "História & Cultura": "historia ruina templo igreja catedral palacio monumento antiguidade",
  "Natureza & Paisagem": "parque jardim natureza montanha lago vista mirante",
  "Praia & Mar": "praia mar barco baia marina costa ilha",
  "Compras": "compras boutique loja shopping mercado",
  "Vida Noturna": "vida noturna bar show espetaculo noite",
  "Romance": "romantico por do sol casal lua de mel intimo",
  "Aventura": "aventura trilha caminhada excursao esqui mergulho",
  "Bem-estar": "spa relax descanso termas massagem piscina",
  "Arquitetura": "arquitetura contemporaneo arranha-ceu design edificio",
  "Parques Temáticos": "disney universal epcot parque tematico",
};

const STOP = new Set(
  "a o e de da do das dos para com por em no na nos nas um uma que se ao aos as os sua seu suas seus pela pelo neste nesta deste desta este esta isso recomendamos sugerimos manha tarde noite dia encerrar seguida visita passeio apos onde mais muito tambem entre sobre ate como sao".split(" ")
);

function stripAccents(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function tokenize(text: string): string[] {
  const t = stripAccents(text.toLowerCase()).replace(/[^a-z0-9 ]/g, " ");
  return t.split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
}

export function cleanActivityText(text: string): string {
  return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/** Vetoriza uma query livre no mesmo espaço TF-IDF do corpus. */
export function vectorizeQuery(text: string): Record<string, number> {
  const toks = tokenize(text);
  const tf: Record<string, number> = {};
  for (const w of toks) if (w in vocab) tf[w] = (tf[w] || 0) + 1;
  const vec: Record<string, number> = {};
  let norm = 0;
  for (const w in tf) {
    const v = tf[w] * (idf[w] || 1);
    vec[String(vocab[w])] = v;
    norm += v * v;
  }
  norm = Math.sqrt(norm) || 1;
  for (const k in vec) vec[k] = vec[k] / norm;
  return vec;
}

export function cosine(a: Record<string, number>, b: Record<string, number>): number {
  let dot = 0;
  const [small, big] = Object.keys(a).length < Object.keys(b).length ? [a, b] : [b, a];
  for (const k in small) if (k in big) dot += small[k] * big[k];
  return dot; // ambos já normalizados
}

export function listDestinations(): Destination[] {
  return destinations;
}
export function getDestination(city: string): Destination | undefined {
  return destinations.find((d) => d.city.toLowerCase() === city.toLowerCase());
}

/* -------------------------------------------------------------------------- */
/* CONCIERGE — composição de roteiro por retrieval do histórico real           */
/* -------------------------------------------------------------------------- */
export type ConciergeDay = {
  day: number; sourceId: string; tripId: string; themes: string[]; text: string;
};
export type ConciergeResult = {
  city: string; country: string; days: ConciergeDay[];
  intro: string; basis: number; preferences: string[];
};

export function buildItinerary(
  city: string, nDays: number, preferences: string = "", themes: string[] = []
): ConciergeResult | null {
  const dest = getDestination(city);
  const pool = activities.filter((a) => a.city.toLowerCase() === city.toLowerCase());
  if (!pool.length) return null;

  const queryText = [preferences, ...themes.map((t) => THEME_KEYWORDS[t] || "")].join(" ").trim();
  const hasQuery = queryText.length > 0;
  const qvec = hasQuery ? vectorizeQuery(queryText) : null;

  // pontua por relevância (se houver preferências) e remove textos duplicados
  const seen = new Set<string>();
  const scored = pool
    .map((a) => ({ a, score: qvec ? cosine(qvec, a.vec) : Math.random() * 0.001 }))
    .filter((x) => {
      const key = x.a.text.slice(0, 80);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((x, y) => y.score - x.score);

  // seleciona dias diversificando temas
  const picked: ConciergeDay[] = [];
  const usedThemes = new Set<string>();
  for (const { a } of scored) {
    if (picked.length >= nDays) break;
    const novel = a.themes.some((t) => !usedThemes.has(t));
    if (picked.length < nDays && (novel || scored.length <= nDays || picked.length < 1)) {
      picked.push({ day: picked.length + 1, sourceId: a.id, tripId: a.trip_id, themes: a.themes, text: cleanActivityText(a.text) });
      a.themes.forEach((t) => usedThemes.add(t));
    }
  }
  // completa se faltou
  if (picked.length < nDays) {
    for (const { a } of scored) {
      if (picked.length >= nDays) break;
      if (!picked.find((p) => p.sourceId === a.id))
        picked.push({ day: picked.length + 1, sourceId: a.id, tripId: a.trip_id, themes: a.themes, text: cleanActivityText(a.text) });
    }
  }
  picked.forEach((p, i) => (p.day = i + 1));

  const country = dest?.country || "";
  const intro = composeIntro(city, country, nDays, [...usedThemes]);
  return { city, country, days: picked, intro, basis: pool.length, preferences: themes };
}

/** Retorna uma alternativa de dia para o destino, evitando os já usados. */
export function pickAlternativeDay(
  city: string, excludeIds: string[], preferences = "", themes: string[] = []
): { sourceId: string; tripId: string; themes: string[]; text: string } | null {
  const exclude = new Set(excludeIds);
  const pool = activities.filter(
    (a) => a.city.toLowerCase() === city.toLowerCase() && !exclude.has(a.id)
  );
  if (!pool.length) return null;

  const queryText = [preferences, ...themes.map((t) => THEME_KEYWORDS[t] || "")].join(" ").trim();
  const qvec = queryText ? vectorizeQuery(queryText) : null;
  const seen = new Set<string>();
  const scored = pool
    .map((a) => ({ a, score: qvec ? cosine(qvec, a.vec) : Math.random() }))
    .filter((x) => {
      const k = x.a.text.slice(0, 80);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((x, y) => y.score - x.score);

  // variedade: sorteia entre os 5 melhores
  const top = scored.slice(0, Math.min(5, scored.length));
  const { a } = top[Math.floor(Math.random() * top.length)];
  return { sourceId: a.id, tripId: a.trip_id, themes: a.themes, text: cleanActivityText(a.text) };
}

export function composeIntro(city: string, country: string, nDays: number, themes: string[]): string {
  const loc = country ? `${city}, ${country}` : city;
  const themeText = themes.length
    ? ` Esta proposta equilibra ${listToText(themes.slice(0, 3).map((t) => t.toLowerCase()))}.`
    : "";
  return `Para ${nDays} ${nDays > 1 ? "dias" : "dia"} em ${loc}, nossos consultores desenharam o roteiro a seguir a partir de experiências reais já vividas por viajantes TTW.${themeText} Cada dia foi pensado para revelar o destino no seu ritmo mais elegante.`;
}
function listToText(items: string[]): string {
  if (items.length <= 1) return items[0] || "";
  return items.slice(0, -1).join(", ") + " e " + items[items.length - 1];
}

/* -------------------------------------------------------------------------- */
/* DESCOBRIDOR — melhor destino a partir dos gostos do cliente                  */
/* -------------------------------------------------------------------------- */
export type MatchResult = {
  city: string; country: string; score: number; themeScore: number; textScore: number;
  topThemes: string[]; why: string; peak_month: string | null;
  highlights: { id: string; text: string }[];
};

export function discoverDestinations(
  preferences: string, themes: string[], topN: number = 4
): MatchResult[] {
  const queryText = [preferences, ...themes.map((t) => THEME_KEYWORDS[t] || "")].join(" ").trim();
  const qvec = vectorizeQuery(queryText);

  const ranked = destinations.map((d) => {
    const textScore = cosine(qvec, d.centroid);
    // afinidade temática direta (média dos temas pedidos)
    let themeScore = 0;
    if (themes.length) {
      themeScore = themes.reduce((s, t) => s + (d.theme_scores[t] || 0), 0) / themes.length;
    }
    const score = 0.55 * textScore + 0.45 * themeScore;
    return { d, textScore, themeScore, score };
  });
  ranked.sort((a, b) => b.score - a.score);

  return ranked.slice(0, topN).map(({ d, textScore, themeScore, score }) => {
    // melhores atividades reais do destino para essa query
    const pool = activities.filter((a) => a.city === d.city);
    const seen = new Set<string>();
    const highlights = pool
      .map((a) => ({ a, s: cosine(qvec, a.vec) }))
      .sort((x, y) => y.s - x.s)
      .filter((x) => {
        const k = x.a.text.slice(0, 60);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 3)
      .map((x) => ({ id: x.a.id, text: cleanActivityText(x.a.text) }));

    const matchedThemes = themes.filter((t) => (d.theme_scores[t] || 0) >= 0.12);
    return {
      city: d.city, country: d.country, score, themeScore, textScore,
      topThemes: d.top_themes, peak_month: d.peak_month,
      why: explainMatch(d, matchedThemes, textScore),
      highlights,
    };
  });
}

function explainMatch(d: Destination, matchedThemes: string[], textScore: number): string {
  const parts: string[] = [];
  if (matchedThemes.length)
    parts.push(`forte em ${listToText(matchedThemes.map((t) => t.toLowerCase()))}`);
  else if (d.top_themes.length)
    parts.push(`conhecido por ${listToText(d.top_themes.slice(0, 2).map((t) => t.toLowerCase()))}`);
  if (textScore > 0.05) parts.push("alta aderência ao que o cliente descreveu");
  if (d.peak_month) parts.push(`melhor época em torno de ${d.peak_month}`);
  const base = parts.length ? parts.join("; ") : "boa cobertura no histórico TTW";
  return `${d.city} foi sugerido por ser ${base}.`;
}
