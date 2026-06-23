# TTW Concierge — Plataforma de Inteligência de Roteiros

> **Demo ao vivo:** https://ttw-concierge.vercel.app · acesso: `consultor@ttw.com` (a senha de demonstração aparece na própria tela de login).

## TL;DR — decisões e por quê (leia isto primeiro)

O case é avaliado pelo **raciocínio com dados imperfeitos** e pela **comunicação para um time não técnico**. As cinco decisões que guiaram a solução:

1. **O dado é o desafio, não a IA.** O campo `city` mistura cidade, etapa e estado da viagem (186 valores). Normalizei para **20 destinos canônicos** com regras documentadas e auditáveis (caixa, acentos, `Check-in…`, `2º Dia -…`, combos `São Paulo / Istambul`, marcadores `Free Day`, cruzeiros). Resultado: **94% das linhas com destino resolvido**.
2. **A descoberta que muda o produto:** são 5.000 linhas, mas apenas **73 narrativas distintas** — as descrições são modelos que se repetem (a mais comum aparece **100×**). Implicação: a base entrega **tom e volume, não variedade fina**. Por isso o Concierge **limita cada roteiro ao número real de experiências distintas do destino** em vez de prometer 7 dias e repetir.
3. **IA sem alucinação:** uso **retrieval** (busca por similaridade no histórico real), não geração livre — uma agência de luxo não pode inventar lugares. Índice **TF-IDF local** (100% offline), com caminho opcional de produção em **pgvector** (Supabase).
4. **Honestidade acima de vaidade:** a sazonalidade é quase plana e a duração das viagens está subamostrada — sinalizo isso **no próprio dashboard**, em vez de inventar tendências.
5. **Comunicação para não-técnicos:** tudo em linguagem de negócio, com o **porquê** em cada recomendação e a qualidade da base apresentada como confiança, não como diagnóstico cru.

**Entregáveis:** Desafio 1 → `/concierge` (roteiros no tom TTW). Desafio 2 → `/dashboard` (inteligência de destinos). Bônus → `/descobrir` (gostos do cliente → destino ideal).

---

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

Para reproduzir o processamento e validar todos os indicadores a partir do CSV bruto:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
npm run data:process
npm run data:validate
```

O acesso e a integração com o Supabase são configurados pelas variáveis descritas em
`.env.example`. Use um arquivo `.env.local`; credenciais e chaves reais não devem ser
versionadas.

Os dados de conteúdo contam com fallback local para manter a experiência disponível em
desenvolvimento quando a fonte remota não estiver acessível.

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
proxy.ts                 # proteção de rotas por sessão (middleware do Next 16)
```

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind · Supabase/pgvector (opcional).
Autenticação por cookie de sessão assinado (HMAC) protegendo as rotas via `proxy.ts` (middleware do
Next 16) — em produção, migrar para Supabase Auth.

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
