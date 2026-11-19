-- Transição de regime de apuração (fiscal/transicao.html): lista de tarefas por cliente.
-- Tabela nova; não altera nada existente. Só o próprio usuário lê e grava.
create table if not exists public.fis_transicoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cliente_id uuid,
  cliente_nome text not null,
  origem text not null,              -- MEI | Simples Nacional | Lucro Presumido | Lucro Real
  destino text not null,
  motivo text,                       -- opção, excesso de receita, obrigatoriedade, atividade vedada…
  efeito_em date,                    -- data em que o novo regime passa a valer
  checklist jsonb not null default '{}'::jsonb,   -- { id_item: 'AAAA-MM-DD' }
  status text not null default 'andamento' check (status in ('andamento', 'concluida', 'cancelada')),
  obs text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.fis_transicoes enable row level security;
create policy fis_transicoes_dono on public.fis_transicoes for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
