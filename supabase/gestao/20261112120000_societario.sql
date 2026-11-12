-- Painel Societário — processos de legalização (abertura, alteração, transformação, encerramento, baixa).
-- Projeto onecnoicxqjhgolqncjj. Cada linha pertence ao usuário que a criou (RLS por user_id).
-- As etapas de cada processo ficam em jsonb: [{ id, nome, feito, data }], geradas a partir do
-- modelo do tipo (societario/societario-core.js) e marcadas no painel.

create table if not exists public.soc_processos (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cliente_id        uuid references public.gclik_clientes(id) on delete set null,  -- vazio na abertura
  empresa           text not null,              -- razão social (ou nome pretendido)
  tipo              text not null,              -- abertura | alteracao | transformacao | encerramento | baixa
  natureza          text,                       -- EI, LTDA, SLU, MEI...
  fluxo             text,                       -- rapido | tradicional (Facilita SP)
  descricao         text,                       -- o que muda / motivo
  responsavel       text,                       -- quem executa (você, freelance...)
  protocolo         text,                       -- protocolo Facilita SP (SPB..., SPN..., SPJ...)
  protocolo_redesim text,                       -- protocolo do DBE no Coletor Nacional
  status            text not null default 'andamento',  -- andamento | exigencia | concluido | cancelado
  exigencia_em      date,                       -- data da exigência (prazo de 30 dias)
  exigencia_motivo  text,
  etapas            jsonb not null default '[]'::jsonb,
  taxas             numeric(14,2),              -- DARE e outras taxas
  honorario         numeric(14,2),              -- valor cobrado do cliente
  iniciado_em       date not null default current_date,
  concluido_em      date,
  obs               text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists soc_processos_user_status on public.soc_processos (user_id, status);

alter table public.soc_processos enable row level security;
drop policy if exists soc_processos_dono on public.soc_processos;
create policy soc_processos_dono on public.soc_processos for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
