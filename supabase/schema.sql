-- Nota a Nota — banco de dados
-- Rode este arquivo inteiro uma vez no Supabase: SQL Editor → New query → colar → Run.
-- Cada tabela tem user_id e RLS: cada pessoa só lê e grava as próprias linhas.

-- Notas fiscais (uma linha por nota; itens em JSON)
create table if not exists public.compras (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data        date not null,
  mercado     text not null,
  cnpj        text default '',
  total       numeric(12,2) not null default 0,
  desconto    numeric(12,2) not null default 0,
  itens       jsonb not null default '[]'::jsonb,
  origem      text default 'app',
  criado_em   timestamptz not null default now()
);
create index if not exists compras_user_data on public.compras (user_id, data);

-- Ajustes por produto: seção escolhida, estoque contado em casa, duração manual
create table if not exists public.produtos (
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  chave         text not null,
  nome          text,
  categoria     text,
  estoque       numeric,
  estoque_em    date,
  duracao_dias  numeric,
  atualizado_em timestamptz not null default now(),
  primary key (user_id, chave)
);

-- Preços pesquisados em outros mercados (opcional, aparece na aba Comparar)
create table if not exists public.cotacoes (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  chave     text not null,
  nome      text,
  mercado   text not null,
  preco     numeric(12,2) not null,
  data      date default current_date,
  fonte     text,
  url       text
);

-- Registro de leituras por foto (para o limite mensal de cada pessoa)
create table if not exists public.uso_leitura (
  id        bigint generated always as identity primary key,
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now()
);

-- ===== Segurança: Row Level Security =====
alter table public.compras     enable row level security;
alter table public.produtos    enable row level security;
alter table public.cotacoes    enable row level security;
alter table public.uso_leitura enable row level security;

drop policy if exists "dono le e grava" on public.compras;
create policy "dono le e grava" on public.compras for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "dono le e grava" on public.produtos;
create policy "dono le e grava" on public.produtos for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "dono le e grava" on public.cotacoes;
create policy "dono le e grava" on public.cotacoes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- uso_leitura: a pessoa vê e registra o próprio uso, mas não pode apagar (senão burlaria o limite)
drop policy if exists "dono le" on public.uso_leitura;
create policy "dono le" on public.uso_leitura for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "dono registra" on public.uso_leitura;
create policy "dono registra" on public.uso_leitura for insert to authenticated with check (user_id = (select auth.uid()));
