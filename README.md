# TTW Concierge — Plataforma de Inteligência de Roteiros

> **Demo ao vivo:** https://ttw-concierge.vercel.app
> **Acesso:** `consultor@ttw.com` — a senha de demonstração aparece na própria tela de login.

Este README é um **relato em primeira pessoa** de como construí esta solução para o case técnico da TTW: o que recebi, como pensei o problema, as decisões que tomei e por quê, e o caminho completo do zero até o MVP entregue e publicado. Escrevi assim de propósito, porque o próprio case diz que o que mais importa não é a solução em si, e sim **o raciocínio e a comunicação**.

---

## 1. O contexto — o case que recebi

> Estou participando de um processo seletivo na empresa **TTW** — empresa de agência de turismo de alto luxo (site: https://ttwgroup.com/pt/home) — para a seguinte vaga:
>
> **TTW Group**, uma empresa de turismo de luxo com mais de 30 anos de mercado e atuação global. Estamos expandindo nossa área de tecnologia e identifiquei que seu perfil pode ter aderência a uma oportunidade de **Desenvolvedor**. Buscamos uma pessoa com perfil **hands-on** para atuar na evolução de sistemas internos, desenvolvimento de automações e soluções com IA.
> 📍 Modelo de trabalho: 100% presencial (Itaim Bibi – São Paulo/SP).
> Benefícios: VR, VT, assistência médica e odontológica, Wellhub (Gympass), convênio com o SESC, assessoria de corrida e parceria com o SENAC.
>
> **Case técnico**
>
> **Contexto:** A TTW (Travel The World) é uma agência de viagens de luxo com histórico de roteiros personalizados montados por consultores. Esse histórico está armazenado numa base de atividades dia a dia — uma linha por dia de viagem, com descrição narrativa das atividades em determinado destino. O arquivo `ttw_case_candidatos.csv` contém uma amostra de **5.000 linhas** dessa base. Os dados refletem a qualidade de uma base real: **imperfeitos, com ruído, prontos para quem sabe trabalhar com eles**.
>
> **Estrutura do arquivo:** `id` (ID único da atividade), `trip_id` (ID da viagem, agrupa os dias de uma mesma viagem), `date` (data do dia de viagem), `city` (cidade destino — **campo com ruído**), `description` (texto narrativo das atividades do dia — **campo principal**).
>
> **Desafio 1 — Concierge de roteiros:** A TTW quer oferecer aos seus consultores sugestões de roteiro para um destino, baseadas no histórico real de viagens. Proponha e construa uma solução.
> *Tom TTW esperado:* "Pela manhã, recomendamos visita ao Coliseu, seguida de uma caminhada pela Via Sacra até o Fórum Romano. À tarde, subam ao Monte Palatino para vistas espetaculares sobre a cidade. Para encerrar, um jantar tranquilo no bairro de Trastevere."
> *Entregável:* o que você achar mais adequado para demonstrar a solução.
>
> **Desafio 2 — Inteligência de destinos:** O que essa base revela sobre os destinos e o comportamento das viagens? Extraia os insights que você considera mais relevantes para o negócio.
> *Entregável:* o que você achar mais adequado para comunicar os achados.
>
> **Avaliação:** Mais do que a solução em si, nos interessa o **raciocínio** — como você lida com dados imperfeitos, quais decisões toma e por quê, e como comunica o resultado para um **time não técnico**.

---

## 2. O que eu construí

Uma **plataforma web interna** para os consultores da TTW, com três módulos e uma identidade visual à altura de uma marca de luxo (carvão profundo + dourado champagne, tipografia serifada). Tudo gira em torno de uma tese central que descrevo na seção 3.

| Módulo | Rota | Responde a |
|---|---|---|
| **Concierge de Roteiros** | `/concierge` | Desafio 1 — gera roteiros no tom TTW a partir do histórico real |
| **Inteligência de Destinos** | `/dashboard` | Desafio 2 — o que a base revela, em linguagem de negócio |
| **Descobrir Destino** *(bônus)* | `/descobrir` | gostos do cliente → destino ideal, com o "porquê" |

Está **publicada na Vercel** e roda **100% offline por padrão** (sem nenhuma dependência externa obrigatória) — o caminho de produção com Supabase/pgvector existe, mas é opcional.

---

## 3. Como pensei o problema (estratégia)

Quatro decisões guiaram todo o resto:

1. **O dado é o desafio, não a IA.** O case foi explícito: a base é ruidosa de propósito. Então a maior parte do meu esforço foi em *entender e tratar a base de forma honesta e auditável*, não em escolher um modelo sofisticado.
2. **Retrieval, não geração livre.** Uma agência de luxo **não pode alucinar lugares**. Em vez de pedir para um LLM "inventar" um roteiro, eu **recupero** experiências reais já vividas por viajantes TTW e as recombino. Zero invenção de locais, e o tom da casa já vem embutido nos textos reais.
3. **Honestidade acima de vaidade.** Onde a base não sustenta uma conclusão (sazonalidade, duração, variedade), eu **digo isso no próprio produto** em vez de mascarar. Achei que isso comunica mais maturidade do que um gráfico bonito e enganoso.
4. **Comunicação para quem não é técnico.** Quem avalia inclui RH e gestores. Então cada tela explica *o que é* e *como ler*, em linguagem de negócio, e cada recomendação vem com um "porquê".

---

## 4. O processo — do zero ao MVP

### 4.1 Auditoria e tratamento da base (pipeline em Python)
Comecei lendo o CSV bruto com **pandas** e medindo a sujeira antes de qualquer coisa. Construí um pipeline único e reproduzível (`scripts/process_data.py`) que **documenta cada decisão** num relatório auditável (`data/relatorio_qualidade.json`) e numa coluna `city_status` na base limpa. Principais decisões:

| Problema na base | Decisão | Resultado |
|---|---|---|
| `city` mistura cidade, etapa e estado (186 valores distintos) | Normalização canônica: caixa/acentos, prefixos (`Check-in Lisboa`, `2º Dia - Madrid`), combos (`São Paulo / Istambul` → destino, ignorando a origem) | **186 → 20 destinos** |
| Marcadores não-cidade (`Free Day`, `Wedding Day`, `Em navegação`) | Classificados como ruído operacional, separados do destino | rotulados, não descartados às cegas |
| 250 descrições vazias (5%) | Excluídas do corpus de busca; contabilizadas no diagnóstico | corpus confiável |
| `01 Ingresso Disney World` (67 linhas) | **Mantidas como "desconhecido"** — investiguei e a narrativa real é de *outras* cidades (Londres, Cairo, Madri…); o `city` é um rótulo de bilheteria. Forçar "Orlando" poluiria o destino. | decisão honesta sobre dado irrecuperável |
| Duração da viagem | A amostra subamostra os dias de cada viagem → **não** inferimos duração real daqui; sinalizo isso no dashboard | leitura honesta |

Resultado: **94% das linhas com destino resolvido** e um corpus de **~4.469 atividades** limpas.

### 4.2 A descoberta que definiu o produto
Ao deduplicar as descrições, encontrei o fato mais importante da base: **as 4.750 descrições preenchidas representam apenas 73 narrativas distintas** (a mais comum aparece **100×**). Ou seja, a base registra **volume, não variedade** — são roteiros-modelo reutilizados. Isso mudou o desenho do produto: o Concierge **nunca promete mais dias do que há experiências realmente distintas** para o destino, e o dashboard trata essa repetição como um insight de negócio, não como um defeito escondido.

### 4.3 Desafio 1 — Concierge de roteiros
Implementei busca semântica **TF-IDF** local (vetorização espelhada entre o Python do pipeline e o TypeScript em `lib/retrieval.ts`) com **similaridade de cosseno**. O fluxo: filtro o destino → pontuo por aderência (quando há temas/preferências) → **deduplico pela narrativa limpa** (sem HTML) → diversifico por tema → componho a introdução no tom TTW. O slider de dias é **limitado ao número real de narrativas distintas** do destino, e o "↻ Trocar" troca um dia evitando repetir o que já está na tela. O consultor pode **Copiar** ou **Imprimir/PDF** a proposta.

### 4.4 Desafio 2 — Inteligência de destinos
Um dashboard executivo que lê a base e responde perguntas de negócio, não só conta linhas:
- **Leia primeiro** — 3 leituras de negócio em uma frase cada.
- **Destinos mais frequentes** e **Assinatura de experiências** (temas por palavras-chave).
- **Matriz destino × tema** — heatmap que mostra *quem lidera cada experiência* (Buenos Aires→Gastronomia, Roma→História, Dubai→Arquitetura, Nova York→Vida Noturna, Miami→Praia).
- **Sazonalidade global** e **Volume por ano** — com a leitura honesta de que a demanda é estável.
- **Tendência por destino** — cross-tab destino × ano.
- **Explorador por destino** — radar de assinatura + sazonalidade do destino.
- **Qualidade da base** — a governança do dado exposta como confiança ("94% resolvido"), não como diagnóstico cru.

### 4.5 Bônus — Descobrir Destino
O consultor descreve o cliente; a plataforma combina **similaridade textual** (gostos × assinatura do destino) com **afinidade temática direta** e devolve os destinos mais aderentes — sempre com o **porquê** e as experiências reais que combinam.

### 4.6 A camada de produto
UI em **Next.js 16 / React 19 / Tailwind**, autenticação por **cookie de sessão HMAC** protegendo as rotas via `proxy.ts` (o middleware do Next 16), navegação responsiva (com menu mobile), e **deploy na Vercel**.

### 4.7 Revisão crítica e correções (o ciclo de QA)
Antes de entregar, fiz uma **revisão crítica** da própria solução contra os critérios do case e corrigi o que encontrei — entre outros: repetição de dias no Concierge (a deduplicação comparava texto com HTML), o slider que prometia mais dias do que a base entrega, latência desnecessária (deixei o Supabase atrás de uma flag explícita), correções de tematização (ex.: `frutos do mar` não é praia), e a comunicação (tirei jargão técnico das telas). Cada correção foi validada na build de produção.

---

## 5. Técnicas e por quê

- **Normalização canônica de texto** (regex + remoção de acentos) para domar o campo `city`.
- **Tematização por dicionário de palavras-chave** (PT) → a "assinatura" de cada destino, o que torna as recomendações **explicáveis**.
- **TF-IDF + similaridade de cosseno** para busca semântica leve, **sem custo de API e sem alucinação** — vetorização idêntica nos dois lados (Python e TS).
- **Deduplicação pela narrativa limpa** para nunca repetir uma experiência (essencial dada a forte repetição da base).
- **Normalização min–max nos heatmaps** para revelar variação real onde os números são próximos.
- **Comparação de senha em tempo constante** (`timingSafeEqual`) e proteção contra open-redirect no login.

## 6. Ferramentas e stack
**Next.js 16** (App Router) · **React 19** · **TypeScript** · **Tailwind CSS** · **Python + pandas** (pipeline de dados) · **Supabase / pgvector** (caminho de produção opcional) · **Vercel** (deploy). Visualizações em **SVG/CSS puro**, sem dependências de gráfico externas.

## 7. Como rodar localmente

```bash
npm install
npm run dev          # http://localhost:3000
```

Reproduzir o tratamento da base a partir do CSV bruto:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
npm run data:process   # lê data/ttw_case_candidatos.csv e regenera os artefatos
npm run data:validate
```

Configuração opcional (Supabase, credencial de demo) em `.env.example` → copie para `.env.local`. Sem nenhuma variável, o app roda 100% no índice local.

## 8. Arquitetura

```
app/
  login/                 # autenticação (tela)
  (app)/dashboard/       # Desafio 2 — inteligência de destinos
  (app)/concierge/       # Desafio 1 — geração de roteiro
  (app)/descobrir/       # bônus — gostos do cliente → destino
  api/{auth,concierge,match}/   # rotas server-side
lib/
  retrieval.ts           # motor de busca/composição (TF-IDF local)
  supabase.ts            # caminho de produção (pgvector), atrás de USE_SUPABASE
  data/*.json            # artefatos gerados pelo pipeline
components/charts.tsx     # BarList, Heat12, MatrixHeat, Radar (SVG/CSS)
scripts/process_data.py   # pipeline de tratamento da base
proxy.ts                  # proteção de rotas por sessão (middleware do Next 16)
```

## 9. Limitações honestas e próximos passos
- A base é templatizada (73 narrativas): ótima para **tom e volume**, limitada para granularidade fina — o produto foi desenhado em torno disso.
- O retrieval reflete fielmente o corpus; em consultas muito específicas, pode trazer um match defensável mas não óbvio.
- A autenticação é uma **porta de demonstração**, não SSO de produção (migrar para Supabase Auth no futuro).
- Próximos passos naturais: cruzar com a base completa para **duração real** e **combos multi-destino** (via `trip_id`), e substituir o índice TF-IDF por embeddings quando houver volume que justifique.

---

*Construído como case técnico para a TTW Group — Travel The World. O objetivo foi que a ferramenta interna **pareça** o produto de luxo que ela serve, e que o raciocínio sobre os dados esteja visível, não escondido no código.*
