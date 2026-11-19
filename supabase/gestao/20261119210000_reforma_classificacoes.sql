-- Reforma Tributária: classificação (CST/cClassTrib) dos produtos e serviços de cada cliente,
-- feita na aba "Classificar XMLs" (reforma/index.html). Tabela nova; não altera nada existente.
create table if not exists public.rt_classificacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cliente_id uuid not null,
  chave text not null,                 -- M|código|NCM (mercadoria) ou S|código|NBS (serviço)
  codigo text, descricao text, ncm text, nbs text, item_lc116 text,
  cst text, cclasstrib text,
  valor_amostra numeric, notas_amostra integer,
  updated_at timestamptz not null default now(),
  unique (user_id, cliente_id, chave)
);
alter table public.rt_classificacoes enable row level security;
create policy rt_classificacoes_dono on public.rt_classificacoes for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
