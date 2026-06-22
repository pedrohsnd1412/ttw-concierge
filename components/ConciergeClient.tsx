"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { THEMES } from "./themes";

type Day = { day: number; sourceId: string; tripId: string; themes: string[]; text: string };
type Result = { city: string; country: string; intro: string; days: Day[]; basis: number };

export default function ConciergeClient({ cities }: { cities: { city: string; country: string }[] }) {
  return (
    <Suspense>
      <ConciergeInner cities={cities} />
    </Suspense>
  );
}

function ConciergeInner({ cities }: { cities: { city: string; country: string }[] }) {
  const params = useSearchParams();
  const [city, setCity] = useState(cities[0]?.city || "");
  const [days, setDays] = useState(3);
  const [prefs, setPrefs] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [swapping, setSwapping] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // pré-preenchimento via link (handoff do Descobrir Destino)
  useEffect(() => {
    const qCity = params.get("city");
    const qPrefs = params.get("prefs");
    const qThemes = params.get("themes");
    const qDays = params.get("days");
    if (qCity && cities.find((c) => c.city === qCity)) setCity(qCity);
    if (qPrefs) setPrefs(qPrefs);
    if (qThemes) setSel(qThemes.split(",").filter(Boolean));
    if (qDays) setDays(Math.min(Math.max(Number(qDays) || 3, 1), 7));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(t: string) {
    setSel((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));
  }

  async function generate() {
    setLoading(true);
    setError("");
    setResult(null);
    setCopied(false);
    const res = await fetch("/api/concierge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city, days, preferences: prefs, themes: sel }),
    });
    setLoading(false);
    if (res.ok) setResult(await res.json());
    else setError((await res.json().catch(() => ({}))).error || "Erro ao gerar roteiro.");
  }

  async function swapDay(dayIndex: number) {
    if (!result) return;
    setSwapping(dayIndex);
    const excludeIds = result.days.map((d) => d.sourceId);
    const res = await fetch("/api/concierge/day", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city: result.city, excludeIds, preferences: prefs, themes: sel }),
    });
    setSwapping(null);
    if (res.ok) {
      const alt = await res.json();
      setResult((r) => {
        if (!r) return r;
        const days = r.days.map((d, i) =>
          i === dayIndex ? { ...d, sourceId: alt.sourceId, tripId: alt.tripId, themes: alt.themes, text: alt.text } : d
        );
        return { ...r, days };
      });
    }
  }

  function plainText(): string {
    if (!result) return "";
    const head = `Roteiro TTW — ${result.city}, ${result.country}\n\n${result.intro}\n`;
    const body = result.days.map((d) => `\nDia ${d.day}\n${d.text}`).join("\n");
    return head + body + "\n\n— Curadoria TTW Concierge";
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(plainText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Não foi possível copiar.");
    }
  }

  return (
    <div className="grid gap-6 lg:h-full lg:min-h-0 lg:grid-cols-[380px_1fr] lg:items-stretch">
      {/* Painel de controle */}
      <div className="card h-fit p-7 no-print lg:h-full lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain">
        <p className="eyebrow">Briefing</p>
        <h2 className="mt-1 font-serif text-2xl text-ivory">Compor roteiro</h2>
        <div className="my-5 hairline" />

        <label className="eyebrow">Destino</label>
        <select value={city} onChange={(e) => setCity(e.target.value)} className="input-luxe mt-2">
          {cities.map((c) => (
            <option key={c.city} value={c.city} className="bg-ink">
              {c.city} — {c.country}
            </option>
          ))}
        </select>

        <label className="eyebrow mt-5 block">Dias de roteiro · {days}</label>
        <input
          type="range" min={1} max={7} value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="mt-3 w-full accent-[#C2A56A]"
        />

        <label className="eyebrow mt-5 block">Preferências do cliente (opcional)</label>
        <textarea
          value={prefs}
          onChange={(e) => setPrefs(e.target.value)}
          rows={3}
          placeholder="ex.: casal apaixonado por gastronomia e arte, ritmo tranquilo"
          className="input-luxe mt-2 resize-none"
        />

        <label className="eyebrow mt-5 block">Tons da viagem</label>
        <div className="mt-3 flex flex-wrap gap-2">
          {THEMES.map((t) => (
            <button
              key={t}
              onClick={() => toggle(t)}
              className={`chip ${sel.includes(t) ? "chip-on" : ""}`}
            >
              {t}
            </button>
          ))}
        </div>

        <button onClick={generate} disabled={loading} className="btn-gold mt-7 w-full">
          {loading ? "Compondo…" : result ? "Gerar novamente" : "Gerar roteiro"}
        </button>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>

      {/* Resultado */}
      <div className="lg:h-full lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:pr-2">
        {!result && !loading && (
          <div className="card flex h-full min-h-[400px] flex-col items-center justify-center p-12 text-center lg:min-h-0">
            <p className="font-serif text-2xl text-ivory/40">A sua proposta aparecerá aqui</p>
            <p className="mt-2 max-w-sm text-sm text-muted">
              Escolha um destino e gere um roteiro construído a partir do histórico real de viagens TTW.
            </p>
          </div>
        )}
        {loading && (
          <div className="card flex h-full min-h-[400px] items-center justify-center p-12 lg:min-h-0">
            <p className="animate-pulse font-serif text-xl text-champagne/70">Curando experiências…</p>
          </div>
        )}
        {result && (
          <div className="fadeup print-area">
            <div className="card p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">Proposta de roteiro</p>
                  <h2 className="mt-2 font-serif text-3xl text-ivory">
                    {result.city}
                    <span className="text-champagne">, {result.country}</span>
                  </h2>
                </div>
                <div className="flex gap-2 no-print">
                  <button onClick={copy} className="btn-ghost">{copied ? "Copiado ✓" : "Copiar"}</button>
                  <button onClick={() => window.print()} className="btn-ghost">Imprimir / PDF</button>
                </div>
              </div>
              <p className="mt-4 text-[15px] leading-relaxed text-ivory/85">{result.intro}</p>
              <p className="mt-3 text-xs text-muted">
                Baseado em {result.basis} atividades reais registradas para {result.city}.
              </p>
            </div>

            <div className="mt-5 space-y-4">
              {result.days.map((d, i) => (
                <div key={d.day} className="card p-7">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-champagne/40 font-serif text-lg text-champagne">
                        {d.day}
                      </div>
                      <div>
                        <p className="eyebrow">Dia {d.day}</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {d.themes.slice(0, 4).map((t) => (
                            <span key={t} className="rounded-full bg-surface px-2.5 py-0.5 text-[11px] text-muted">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => swapDay(i)}
                      disabled={swapping === i}
                      className="no-print text-xs uppercase tracking-[0.12em] text-muted transition hover:text-champagne disabled:opacity-40"
                      title="Sugerir outra experiência para este dia"
                    >
                      {swapping === i ? "Trocando…" : "↻ Trocar"}
                    </button>
                  </div>
                  <p className="mt-4 text-[15px] leading-relaxed text-ivory/90">{d.text}</p>
                </div>
              ))}
            </div>

            <p className="mt-5 text-center text-xs text-muted/70 no-print">
              Roteiro montado por retrieval do histórico real — sem invenção de locais. Use “Trocar” para variar um dia.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
