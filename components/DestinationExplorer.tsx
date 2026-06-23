"use client";
import { useState } from "react";
import Link from "next/link";
import { Radar, Heat12 } from "./charts";

type Perfil = { city: string; theme_scores: Record<string, number>; top_themes: string[]; unique_narratives?: number };
type Sazon = { city: string; seasonality: number[]; peak: string | null };

export default function DestinationExplorer({
  perfis, sazon, meses,
}: {
  perfis: Perfil[];
  sazon: Sazon[];
  meses: string[];
}) {
  const [city, setCity] = useState(perfis[0]?.city || "");
  const perfil = perfis.find((p) => p.city === city);
  const season = sazon.find((s) => s.city === city);

  // top 8 temas para o radar
  const radarAxes = perfil
    ? Object.entries(perfil.theme_scores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([axis, value]) => ({ axis: axis.replace(" & ", "/").split(" ")[0], value }))
    : [];

  return (
    <div className="card p-7">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Perfil do destino</p>
          <h3 className="mt-1 font-sans text-2xl font-medium tracking-tight text-ivory">{city}</h3>
        </div>
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="input-luxe w-56"
        >
          {perfis.map((p) => (
            <option key={p.city} value={p.city} className="bg-ink">
              {p.city}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <p className="mb-2 text-xs uppercase tracking-luxe text-muted">Assinatura de experiências</p>
          <Radar data={radarAxes} />
          {perfil?.unique_narratives != null && (
            <p className="mt-3 text-center text-xs text-muted">
              Assinatura baseada em {perfil.unique_narratives} narrativas distintas — leitura de perfil, não de estatística robusta.
            </p>
          )}
        </div>
        <div className="flex flex-col justify-center">
          <p className="mb-3 text-xs uppercase tracking-luxe text-muted">
            Volume mensal {season?.peak ? `· mais registros em ${season.peak} (dentro do ruído da amostra)` : ""}
          </p>
          {season && <Heat12 values={season.seasonality} labels={meses} />}
          <div className="mt-6 flex flex-wrap gap-2">
            {perfil?.top_themes.map((t) => (
              <span key={t} className="chip chip-on">{t}</span>
            ))}
          </div>
          <Link
            href={`/concierge?city=${encodeURIComponent(city)}&themes=${encodeURIComponent((perfil?.top_themes || []).slice(0, 2).join(","))}`}
            className="btn-ghost mt-6 w-fit"
          >
            Montar roteiro em {city} →
          </Link>
        </div>
      </div>
    </div>
  );
}
