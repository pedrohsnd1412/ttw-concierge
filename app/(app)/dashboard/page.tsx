import insights from "@/public/data/insights.json";
import { PageHeader, PageShell, Kpi, SectionTitle } from "@/components/ui";
import { BarList, Heat12 } from "@/components/charts";
import DestinationExplorer from "@/components/DestinationExplorer";

export default function DashboardPage() {
  const k = insights.kpis;
  const q = insights.quality;

  const ranking = insights.destinos_ranking
    .slice(0, 12)
    .map((d) => ({ label: d.city, value: d.activities, sub: `· ${d.country}` }));
  const temas = insights.temas_globais
    .slice(0, 10)
    .map((t) => ({ label: t.theme, value: t.count }));

  const totalCity = q.city_status as Record<string, number>;
  const resolved = q.linhas_com_destino_resolvido;
  return (
    <PageShell
      header={
        <PageHeader
          eyebrow="Inteligência de Destinos · Visão Executiva"
          title="O que nosso histórico revela"
          subtitle="Leitura do histórico real de roteiros TTW: para onde se viaja, em que época, com que assinatura de experiências — e o estado da base que sustenta tudo isso."
        />
      }
      pinned={
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Kpi value={k.atividades.toLocaleString("pt-BR")} label="Atividades" hint="linhas na amostra" />
          <Kpi value={k.viagens.toLocaleString("pt-BR")} label="Viagens únicas" />
          <Kpi value={k.destinos} label="Destinos canônicos" hint="de 186 valores brutos" />
          <Kpi value={k.anos} label="Período coberto" />
          <Kpi value={`${k.cobertura_descricao}%`} label="Com descrição" hint="campo principal" />
        </div>
      }
    >
      {/* Ranking + Temas */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-7">
          <SectionTitle note="registros válidos por destino">Destinos mais frequentes</SectionTitle>
          <BarList data={ranking} />
        </div>
        <div className="card p-7">
          <SectionTitle note="classificações por palavras-chave">Assinatura de experiências</SectionTitle>
          <BarList data={temas} />
          <p className="mt-5 text-xs leading-relaxed text-muted">
            Gastronomia, história & cultura e natureza & paisagem aparecem com maior frequência.
            Uma mesma atividade pode receber vários temas; os totais, portanto, não são mutuamente exclusivos.
          </p>
        </div>
      </div>

      {/* Sazonalidade global */}
      <div className="mt-6 card p-7">
        <SectionTitle note="atividades por mês · 5.000 linhas">Sazonalidade global</SectionTitle>
        <Heat12 values={insights.sazonalidade_global} labels={insights.meses_label} />
        <p className="mt-5 text-xs leading-relaxed text-muted">
          A distribuição é relativamente uniforme: fevereiro tem 447 registros, julho 438 e setembro 399.
          A amostra não sustenta uma concentração sazonal forte; os picos por destino devem ser lidos como volume
          observado, não como recomendação automática de melhor época.
        </p>
      </div>

      {/* Explorador por destino */}
      <div className="mt-6">
        <DestinationExplorer
          perfis={insights.perfil_por_destino}
          sazon={insights.sazonalidade_por_destino}
          meses={insights.meses_label}
        />
      </div>

      {/* Duração / perfil de viagem */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-7">
          <SectionTitle>Duração & perfil de viagem</SectionTitle>
          <p className="text-sm leading-relaxed text-ivory/80">
            Na amostra de {k.atividades.toLocaleString("pt-BR")} linhas, {insights.duracao.distribuicao["1"]?.toLocaleString("pt-BR")} viagens
            aparecem com 1 dia e {insights.duracao.distribuicao["2"]?.toLocaleString("pt-BR")} com 2 dias —
            média de <span className="text-champagne">{insights.duracao.media_dias_amostra}</span> dias amostrados
            por viagem.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Leitura honesta: a amostra subamostra os dias de cada viagem (uma fração do roteiro completo).
            Por isso a duração real não deve ser inferida daqui — o sinal forte está em <em>quais</em> destinos e
            <em> quais</em> experiências, não em quantos dias. Recomenda-se cruzar com a base completa para
            duração e combos multi-destino.
          </p>
        </div>
        <div className="card p-7">
          <SectionTitle note="governança de dados">Qualidade da base</SectionTitle>
          <div className="space-y-3 text-sm">
            <QualityRow label="Destino resolvido" value={`${resolved.toLocaleString("pt-BR")} (${Math.round((resolved / q.linhas_totais) * 100)}%)`} good />
            <QualityRow label="Utilizáveis nas recomendações" value={`${q.linhas_utilizaveis.toLocaleString("pt-BR")} (${q.pct_linhas_utilizaveis}%)`} good />
            <QualityRow label="Já limpos" value={(totalCity["limpo"] || 0).toLocaleString("pt-BR")} />
            <QualityRow label="Normalizados (caixa, check-in, combos)" value={(totalCity["normalizado"] || 0).toLocaleString("pt-BR")} />
            <QualityRow label="Marcadores operacionais (Free Day, Wedding…)" value={(totalCity["marcador_operacional"] || 0).toString()} warn />
            <QualityRow label="Em navegação (cruzeiros)" value={(totalCity["em_navegacao"] || 0).toString()} warn />
            <QualityRow label="Cidade não reconhecida" value={(totalCity["desconhecido"] || 0).toString()} warn />
            <QualityRow label="Descrições vazias" value={`${q.descricoes_vazias} (${q.pct_descricoes_vazias}%)`} warn />
            <QualityRow label="Narrativas distintas após limpeza" value={q.narrativas_distintas.toLocaleString("pt-BR")} warn />
            <QualityRow label="Descrições com marcação HTML" value={q.descricoes_com_html.toLocaleString("pt-BR")} warn />
          </div>
          <p className="mt-5 text-xs leading-relaxed text-muted">
            O campo <code className="text-champagne/80">city</code> mistura cidade, etapa operacional e estado da viagem.
            A solução consolidou 186 variações em 20 destinos. Há forte repetição textual: as 4.750 descrições
            preenchidas representam 73 narrativas distintas após a remoção de HTML. Por isso, frequências mostram
            volume de registros, não variedade de experiências.
          </p>
        </div>
      </div>
    </PageShell>
  );
}

function QualityRow({ label, value, good, warn }: { label: string; value: string; good?: boolean; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-line/60 pb-2">
      <span className="text-ivory/75">{label}</span>
      <span className={good ? "text-champagne" : warn ? "text-amber-300/80" : "text-ivory/90"}>{value}</span>
    </div>
  );
}
