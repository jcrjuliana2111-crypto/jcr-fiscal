-- JCR Entregas: cadastro de regimes tributários (antes era uma lista fixa na tela).
-- O regime do cliente continua em gclik_clientes.regime (texto), compartilhado com o Gestão Fiscal;
-- as obrigações guardam os nomes dos regimes em ent_obrigacoes.regimes.
create table if not exists public.ent_regimes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome       text not null,
  descricao  text,
  ordem      int  not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, nome)
);
alter table public.ent_regimes enable row level security;
drop policy if exists ent_regimes_dono on public.ent_regimes;
create policy ent_regimes_dono on public.ent_regimes for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
