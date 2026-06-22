# TTW Concierge — Plataforma de Inteligência de Roteiros

Plataforma interna para a equipe de consultores TTW, construída em Next.js + React
com uma experiência visual alinhada ao turismo de alto luxo:

- **Concierge de roteiros:** gera sugestões de roteiro para um destino, no
  tom TTW, a partir do **histórico real** de viagens (retrieval — sem inventar lugares).
- **Inteligência de destinos:** um dashboard que lê a base e revela destinos,
  sazonalidade, perfil/assinatura de cada lugar e o estado de qualidade dos dados.
- **Bônus pedido na conversa — Descobrir Destino:** o consultor descreve os gostos do
  cliente e a plataforma recomenda o destino e as experiências mais aderentes, com o porquê.

> Tudo roda **sem nenhuma configuração externa** (fallback local). O caminho de produção
> com **Supabase + pgvector** já está implementado e documentado — basta preencher o `.env`.

---

## Como rodar localmente

```bash
npm install
npm run dev
# abra http://localhost:3000
```

Login de demonstração:

- **e-mail:** `consultor@ttw.com`
- **senha:** `ttwluxo2026`

Não precisa de banco, chave de API nem internet (exceto para as fontes, que têm fallback).

---

## Decisões sobre a base (o ponto central do case)

A base é real: imperfeita e ruidosa. O pipeline (`scripts/process_data.py`) trata o ruído
de forma **documentada e auditável** — toda decisão fica registrada em
`data/relatorio_qualidade.json` e na coluna `city_status` da base limpa.

| Problema encontrado | Decisão tomada | Resultado |
|---|---|---|
| Campo `city` mistura cidade, etapa e estado (186 valores distintos) | Normalização canônica: caixa (`MIAMI`→`Miami`), prefixos (`Check-in Lisboa`, `2º Dia - Madrid`, `Chegada e check-in em…`), combos (`São Paulo / Istambul` → destino, ignorando origem) | **186 → 20 destinos** |
| Marcadores não-cidade (`Free Day`, `Wedding Day`, `Em navegação`) | Classificados e separados como ruído operacional, não como destino | 292 linhas isoladas com rótulo |
| 250 descrições vazias (5%) | Excluídas do corpus de retrieval; contabilizadas no diagnóstico de qualidade | corpus confiável |
| Duração de viagem | A amostra subamostra os dias de cada viagem → **não** inferimos duração real daqui; sinalizamos isso explicitamente no dashboard | leitura honesta |

Resultado: **94% das linhas com destino resolvido** e um corpus de **4.469 atividades**
limpas para alimentar a IA.

### Perfil/assinatura de cada destino
Cada atividade é classificada em temas (Gastronomia, Arte & Museus, História & Cultura,
Natureza, Praia & Mar, Romance, Aventura, Parques Temáticos, etc.) por um dicionário de
palavras-chave em PT. Isso vira a "assinatura" de cada destino — base do dashboard e do
Descobrir Destino, e o que torna as recomendações **explicáveis**.

---

## Como a IA funciona

**Retrieval, não geração livre.** O texto que o consultor vê vem de roteiros reais já
vividos por viajantes TTW — o sistema seleciona, diversifica por tema e recombina. Isso
evita alucinação de locais e mantém o tom da casa.

- **Fallback local:** índice **TF-IDF** local (vetorização espelhada entre o Python e o
  TypeScript em `lib/retrieval.ts`). Busca por similaridade de cosseno, 100% offline.
- **Modo produção (Supabase):** busca vetorial em **pgvector**, com os vetores TF-IDF
  auditáveis do próprio pipeline (sem custo externo e sem alucinação).
  - `supabase/schema.sql` — tabelas + função `match_activities` (cosine ANN).
  - `npm run seed:supabase` — popula o banco com os vetores locais já calculados.
  - `npm run ingest:openai` — caminho opcional para substituir o índice por embeddings
    `text-embedding-3-small` quando houver uma chave OpenAI.
  - Ative preenchendo `.env.local` (veja `.env.example`). Se o serviço estiver
    indisponível, o app faz fallback automático para o índice local.

O **Descobrir Destino** combina dois sinais: similaridade textual (gostos × assinatura do
destino) + afinidade temática direta, e sempre devolve o **porquê** da recomendação.

---

## Arquitetura

```
app/
  login/                 # autenticação (tela)
  (app)/dashboard/       # inteligência de destinos
  (app)/concierge/       # geração de roteiro
  (app)/descobrir/       # gostos do cliente → destino ideal
  api/{auth,concierge,match}/   # rotas server-side
lib/
  retrieval.ts           # motor de busca/composição (fallback local)
  supabase.ts            # caminho de produção (pgvector)
  data/*.json            # artefatos gerados pelo pipeline
scripts/
  process_data.py        # pipeline de tratamento da base
  ingest_supabase.mjs    # ingestão de embeddings (produção)
supabase/schema.sql      # esquema pgvector + RPC
middleware.ts            # proteção de rotas por sessão
```

**Stack:** Next.js 14 (App Router) · React · TypeScript · Tailwind · Supabase/pgvector (opcional).
Autenticação por cookie de sessão assinado (HMAC) protegendo as rotas via middleware — em
produção, migrar para Supabase Auth.

### Regenerar os artefatos de dados
```bash
pip install pandas
python scripts/process_data.py     # lê data/ttw_case_candidatos.csv
```

---

## Identidade visual
Inspirada no posicionamento TTW (curadoria, exclusividade, alcance global): paleta
carvão profundo + dourado champagne, tipografia serifada (Cormorant Garamond) com Inter,
hairlines douradas e respiro generoso. O objetivo é que a ferramenta interna **pareça** o
produto de luxo que ela serve.
