import { PageHeader } from "@/components/ui";
import DescobrirClient from "@/components/DescobrirClient";

export default function DescobrirPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Concierge · Descobrir Destino"
        title="Do gosto do cliente ao destino certo"
        subtitle="O consultor descreve o que o cliente busca; a plataforma compara com a assinatura real de cada destino e recomenda os mais aderentes — com o porquê e as experiências que combinam."
      />
      <DescobrirClient />
    </div>
  );
}
