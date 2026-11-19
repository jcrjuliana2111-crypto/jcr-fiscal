-- Onboarding de clientes (comercial/index.html): oportunidades do orçamento à implantação
-- e a configuração do comercial (dados do escritório, tabela de preços e textos).
-- Tabelas novas; não alteram nada existente. Só o próprio usuário lê e grava.
create table if not exists public.com_config (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  escritorio jsonb not null default '{}'::jsonb,
  precos jsonb not null default '{}'::jsonb,
  textos jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.com_oportunidades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null,
  etapa text not null default 'lead',
  dados jsonb not null default '{}'::jsonb,       -- qualificação do cliente
  orcamento jsonb,                                 -- último orçamento calculado
  contrato jsonb not null default '{}'::jsonb,     -- datas e condições do contrato
  checklist jsonb not null default '{}'::jsonb,    -- itens de implantação feitos { id: 'AAAA-MM-DD' }
  historico jsonb not null default '[]'::jsonb,    -- mudanças de etapa
  cliente_id uuid,                                 -- gclik_clientes.id depois do cadastro
  soc_processo_id uuid,                            -- soc_processos.id, quando há abertura/transformação
  data_proposta date,
  perdido_motivo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists com_oportunidades_user_idx on public.com_oportunidades (user_id, updated_at desc);
alter table public.com_config enable row level security;
alter table public.com_oportunidades enable row level security;
create policy com_config_dono on public.com_config for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy com_oportunidades_dono on public.com_oportunidades for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
