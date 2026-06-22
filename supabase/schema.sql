-- ============================================================================
-- TTW Concierge — esquema Supabase (produção)
-- Busca vetorial de atividades com pgvector.
-- Execute no SQL Editor do Supabase (ou via migração).
-- ============================================================================

create extension if not exists vector;

-- Atividades (corpus de roteiros tratado pelo pipeline)
create table if not exists activities (
  id          text primary key,
  trip_id     text,
  city        text not null,
  country     text,
  month       int,
  themes      text[],
  description text not null,
  embedding   vector(1536)            -- text-embedding-3-small
);

create index if not exists activities_city_idx on activities (city);

-- Índice ANN (cosine). ivfflat exige ANALYZE após carga.
create index if not exists activities_embedding_idx
  on activities using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Perfil agregado por destino (sazonalidade, temas, centroide)
create table if not exists destinations (
  city          text primary key,
  country       text,
  activities    int,
  trips         int,
  theme_scores  jsonb,
  top_themes    text[],
  seasonality   int[],
  peak_month    text
);

-- A aplicação acessa estas tabelas somente no servidor, com a secret key.
-- Sem políticas públicas, anon/authenticated não conseguem ler nem alterar os dados.
alter table activities enable row level security;
alter table destinations enable row level security;

-- ----------------------------------------------------------------------------
-- RPC: busca as k atividades mais similares à query (opcionalmente por cidade)
-- ----------------------------------------------------------------------------
create or replace function match_activities (
  query_embedding vector(1536),
  match_count int default 8,
  filter_city text default null
)
returns table (
  id text,
  city text,
  country text,
  themes text[],
  description text,
  similarity float
)
language sql stable
as $$
  select
    a.id, a.city, a.country, a.themes, a.description,
    1 - (a.embedding <=> query_embedding) as similarity
  from activities a
  where filter_city is null or a.city = filter_city
  order by a.embedding <=> query_embedding
  limit match_count;
$$;
