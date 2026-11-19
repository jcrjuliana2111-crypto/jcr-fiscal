-- Reforma Tributária: simulações de IBS/CBS por cliente (reforma/index.html).
-- Tabela nova; não altera nada existente. Só o próprio usuário lê e grava.
create table if not exists public.rt_simulacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cliente_id uuid,
  cliente_nome text,
  nome text not null default 'Simulação',
  dados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rt_simulacoes_user_idx on public.rt_simulacoes (user_id, updated_at desc);
alter table public.rt_simulacoes enable row level security;
create policy rt_simulacoes_dono on public.rt_simulacoes for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
