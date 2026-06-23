# TTW Concierge — Plataforma de Inteligência de Roteiros

> **Acesse o app:** **https://ttw-concierge.vercel.app** · login `consultor@ttw.com` (a senha de demonstração aparece na própria tela). Não precisa instalar nada — roda 100% online.

Este é o meu case técnico para a TTW. Escrevi este README como um **relato**, em primeira pessoa e na ordem em que as coisas aconteceram, porque o que mais importava no case não era a solução pronta — e sim **como eu raciocino com dados imperfeitos e comunico para um time não técnico**.

## O ponto de partida

Recebi uma amostra de **5.000 linhas** de um histórico real de roteiros de luxo: uma linha por dia de viagem, com a narrativa do dia e a cidade — esta última cheia de ruído. O pedido tinha duas frentes: **(1)** sugerir roteiros para um destino a partir desse histórico, no tom da casa, e **(2)** extrair o que a base revela sobre destinos e comportamento de viagem. A frase do case que ficou comigo foi *"dados imperfeitos, prontos para quem sabe trabalhar com eles"* — então tratei o **dado** como o verdadeiro desafio, não a IA.

## Como trabalhei: entender e repartir em partes

Em vez de sair codando a feature mais vistosa, fui **incremental** — e boa parte da construção foi conduzida num fluxo assistido por IA, dirigindo e validando cada etapa: primeiro entendi o problema, depois o reparti em pedaços e só avançava para o próximo quando o anterior estava de pé. A ordem foi essa:

**1. Antes de tudo, medi a sujeira.** Abri o CSV e contei o estrago: 186 valores diferentes no campo de cidade, 5% de descrições vazias, HTML no meio do texto. Montei um pipeline em Python que normaliza tudo de forma **documentada e auditável** — 186 cidades viram **20 destinos canônicos**, com cada decisão registrada num relatório de qualidade. Cheguei a **94% das linhas com destino resolvido**.

**2. Achei o fato que mudou o produto.** Ao deduplicar as descrições, descobri que as ~4.750 narrativas preenchidas são, na verdade, **73 textos distintos** (o mais comum se repete 100×). A base tem **tom e volume, não variedade**. Isso definiu todo o resto: o Concierge nunca promete mais dias do que há experiências realmente distintas, e o dashboard trata essa repetição como insight — não como defeito escondido.

**3. Desafio 1 — o Concierge.** Em vez de pedir para uma IA inventar lugares (inaceitável para uma marca de luxo), fiz **busca por similaridade no histórico real** (TF-IDF + cosseno) e recombino experiências que de fato aconteceram. Deduplico pela narrativa limpa, diversifico por tema e componho a introdução no tom TTW. O consultor escolhe destino, dias e tons, troca um dia se quiser e copia/imprime a proposta.

**4. Desafio 2 — a Inteligência de destinos.** Um dashboard que responde perguntas de negócio, não só conta linhas: para onde se viaja, **quem lidera cada experiência** (matriz destino × tema), quando, a tendência por destino e — com honestidade — o que a base *não* sustenta (sazonalidade fraca, duração subamostrada). A qualidade do dado aparece como confiança, não como diagnóstico cru.

**5. O bônus — Descobrir Destino.** O consultor descreve o cliente e a plataforma recomenda o destino mais aderente, sempre com o **porquê** e as experiências reais que combinam.

**6. Empacotei e revisei.** Dei à ferramenta uma cara de produto de luxo (carvão + dourado champagne), coloquei login, deixei responsiva e publiquei na Vercel. No fim, fiz uma **revisão crítica da minha própria solução** contra os critérios do case e corrigi o que encontrei — repetição de dias, um slider que prometia mais do que a base entrega, jargão nas telas, latência desnecessária — validando cada ajuste na versão publicada.

## Técnicas e stack

TF-IDF + similaridade de cosseno · normalização canônica de texto · tematização por dicionário de palavras-chave · deduplicação pela narrativa limpa · normalização min–max nos heatmaps.
**Next.js 16 · React 19 · TypeScript · Tailwind · Python/pandas · Supabase/pgvector (opcional) · Vercel.** Visualizações em SVG/CSS puro, sem bibliotecas de gráfico.

## Limitações que assumo

A base é templatizada (73 narrativas) — ótima para tom e volume, limitada para granularidade fina, e o produto foi desenhado em torno disso. O login é uma porta de demonstração, não SSO de produção. O passo natural seguinte é cruzar com a base completa para **duração real** e **combos multi-destino** (via `trip_id`).

---

*Mais do que entregar telas bonitas, quis mostrar **como decido diante de um dado imperfeito** — e fazer a ferramenta interna parecer o produto de luxo que ela serve, com o raciocínio à mostra, não escondido no código.*
