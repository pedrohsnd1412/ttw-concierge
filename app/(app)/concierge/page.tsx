import insights from "@/public/data/insights.json";
import { PageHeader, PageShell } from "@/components/ui";
import ConciergeClient from "@/components/ConciergeClient";
import { listDestinations } from "@/lib/retrieval";

export default function ConciergePage() {
  // nº de narrativas distintas por destino → teto honesto de dias do roteiro
  const maxByCity = Object.fromEntries(
    listDestinations().map((d) => [d.city, d.unique_narratives])
  ) as Record<string, number>;
  const cities = insights.destinos_ranking.map((d) => ({
    city: d.city,
    country: d.country,
    // teto = nº de narrativas distintas, limitado ao máximo de 7 dias do produto
    maxDays: Math.min(maxByCity[d.city] || 1, 7),
  }));
  return (
    <PageShell
      contained
      header={
        <PageHeader
          eyebrow="Concierge de Roteiros · Curadoria Inteligente"
          title="Sugestões no tom TTW"
          subtitle="Para qualquer destino do histórico, o consultor gera em segundos uma proposta de roteiro escrita no tom da casa — recombinando experiências reais já vividas por viajantes TTW."
        />
      }
    >
      <ConciergeClient cities={cities} />
    </PageShell>
  );
}
