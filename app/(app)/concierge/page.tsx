import insights from "@/public/data/insights.json";
import { PageHeader } from "@/components/ui";
import ConciergeClient from "@/components/ConciergeClient";

export default function ConciergePage() {
  const cities = insights.destinos_ranking.map((d) => ({ city: d.city, country: d.country }));
  return (
    <div>
      <PageHeader
        eyebrow="Desafio 1 · Concierge de Roteiros"
        title="Sugestões no tom TTW"
        subtitle="Para qualquer destino do histórico, o consultor gera em segundos uma proposta de roteiro escrita no tom da casa — recombinando experiências reais já vividas por viajantes TTW."
      />
      <ConciergeClient cities={cities} />
    </div>
  );
}
