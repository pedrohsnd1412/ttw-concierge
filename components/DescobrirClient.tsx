"use client";
import { useState } from "react";
import Link from "next/link";
import { THEMES } from "./themes";

type Match = {
  city: string; country: string; score: number; themeScore: number; textScore: number;
  topThemes: string[]; why: string; peak_month: string | null;
  highlights: { id: string; text: string }[];
};

const EXAMPLES = [
  "Casal em lua de mel, gosta de gastronomia, vinhos e pôr do sol romântico",
  "Família com crianças, parques e diversão, ritmo animado",
  "Apaixonados por arte, museus, história e arquitetura clássica",
  "Aventura, natureza, paisagens e experiências ao ar livre",
];

export default function DescobrirClient() {
  const [prefs, setPrefs] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Match[] | null>(null);
  const [error, setError] = useState("");

  function toggle(t: string) {
    setSel((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));
  }

  async function discover() {
    setLoading(true);
    setError("");
    setResults(null);
    const res = await fetch("/api/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferences: prefs, themes: sel }),
    });
    setLoading(false);
    if (res.ok) setResults((await res.json()).results);
    else setError((await res.json().catch(() => ({}))).error || "Erro na busca.");
  }

  const maxScore = results?.length ? Math.max(...results.map((r) => r.score), 0.0001) : 1;

  return (
    <div className="grid gap-6 lg:h-full lg:min-h-0 lg:grid-cols-[380px_1fr] lg:items-stretch">
      <div className="card h-fit p-7 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain">
        <label className="eyebrow">Gostos e perfil do cliente</label>
        <textarea
          value={prefs}
          onChange={(e) => setPrefs(e.target.value)}
          rows={3}
          placeholder="Descreva o cliente: com quem viaja, do que gosta, ritmo desejado, ocasião…"
          className="input-luxe mt-2 resize-none"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button key={ex} onClick={() => setPrefs(ex)} className="rounded-full border border-line px-3 py-1 text-xs text-muted transition hover:border-champagne/50 hover:text-champagne">
              {ex.split(",")[0]}…
            </button>
          ))}
        </div>

        <div className="my-5 hairline" />

        <label className="eyebrow">Temas de interesse</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {THEMES.map((t) => (
            <button key={t} onClick={() => toggle(t)} className={`chip ${sel.includes(t) ? "chip-on" : ""}`}>
              {t}
            </button>
          ))}
        </div>

        <button onClick={discover} disabled={loading} className="btn-gold mt-6 w-full">
          {loading ? "Buscando destinos…" : "Encontrar destino ideal"}
        </button>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>

      <div className="lg:h-full lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:pr-2">
        {!results && !loading && (
          <div className="card flex h-full min-h-[400px] flex-col items-center justify-center p-12 text-center lg:min-h-0">
            <p className="font-sans text-2xl font-medium tracking-tight text-ivory/40">As recomendações aparecerão aqui</p>
            <p className="mt-2 max-w-sm text-sm text-muted">
              Descreva o perfil do cliente para comparar suas preferências com a assinatura real dos destinos.
            </p>
          </div>
        )}

        {loading && (
          <div className="card flex h-full min-h-[400px] items-center justify-center p-12 lg:min-h-0">
            <p className="animate-pulse font-sans text-xl font-medium text-champagne/70">Comparando destinos…</p>
          </div>
        )}

        {results && (
          <div className="fadeup">
          <p className="eyebrow mb-4">Destinos recomendados · índice comparativo desta busca</p>
          <div className="grid gap-5">
            {results.map((r, i) => (
              <div key={r.city} className="card p-7">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="eyebrow">#{i + 1} · índice {Math.round((r.score / maxScore) * 100)}</p>
                    <h3 className="mt-1 font-sans text-2xl font-medium tracking-tight text-ivory">
                      {r.city}
                      <span className="text-champagne">, {r.country}</span>
                    </h3>
                  </div>
                  {r.peak_month && (
                    <span className="rounded-full border border-line px-3 py-1 text-xs text-muted">
                      mais registros · {r.peak_month}
                    </span>
                  )}
                </div>

                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface">
                  <div className="h-full rounded-full bg-gradient-to-r from-champagne-dark to-champagne-light"
                    style={{ width: `${(r.score / maxScore) * 100}%` }} />
                </div>

                <p className="mt-4 text-sm leading-relaxed text-ivory/85">{r.why}</p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {r.topThemes.map((t) => (
                    <span key={t} className="rounded-full bg-surface px-2.5 py-0.5 text-[11px] text-muted">{t}</span>
                  ))}
                </div>

                {r.highlights.length > 0 && (
                  <div className="mt-5">
                    <p className="text-xs uppercase tracking-luxe text-muted">Experiências que combinam</p>
                    <ul className="mt-2 space-y-2">
                      {r.highlights.map((h) => (
                        <li key={h.id} className="border-l-2 border-champagne/30 pl-3 text-[13px] leading-relaxed text-ivory/75">
                          {h.text.length > 180 ? h.text.slice(0, 180) + "…" : h.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <Link
                  href={`/concierge?city=${encodeURIComponent(r.city)}&prefs=${encodeURIComponent(prefs)}&themes=${encodeURIComponent(sel.join(","))}`}
                  className="btn-ghost mt-6 w-full"
                >
                  Montar roteiro deste destino →
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            O índice é relativo ao destino mais aderente desta busca; não representa probabilidade nem percentual absoluto.
          </p>
          </div>
        )}
      </div>
    </div>
  );
}
