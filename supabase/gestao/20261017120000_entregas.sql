-- JCR Entregas (estilo Acessórias) — projeto Supabase onecnoicxqjhgolqncjj (o mesmo do Gestão Fiscal).
-- Usa os clientes de gclik_clientes. Cada linha pertence ao usuário que a criou (RLS por user_id).

-- Catálogo de obrigações / entregas recorrentes
create table if not exists public.ent_obrigacoes (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome              text not null,
  departamento      text not null default 'Fiscal',
  esfera            text not null default 'Federal',          -- Federal | Estadual | Municipal | Interna
  recorrencia       text not null default 'mensal',           -- mensal | bimestral | trimestral | semestral | anual
  dia_vencimento    int  not null default 20,                 -- 0 = último dia útil
  tipo_dia          text not null default 'corridos',         -- corridos | uteis
  ajuste            text not null default 'antecipa',         -- antecipa | prorroga | mantem
  competencia_meses int  not null default 1,                  -- vence N meses após a competência
  mes_vencimento    int,                                      -- anual: mês do vencimento no ano seguinte
  meta_dias         int  not null default 2,                  -- meta interna: dias úteis antes do vencimento
  regimes           text[] not null default '{}',             -- vazio = todos
  multa             boolean not null default true,
  envia_cliente     boolean not null default true,            -- entrega gera documento para o cliente
  ativo             boolean not null default true,
  observacoes       text,
  created_at        timestamptz not null default now()
);

-- Dados do cliente que o Gestão Fiscal não tem: responsáveis por departamento e acesso ao portal
create table if not exists public.ent_clientes (
  cliente_id    uuid primary key references public.gclik_clientes(id) on delete cascade,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  responsaveis  jsonb not null default '{}'::jsonb,           -- {"Fiscal":"Ana","Pessoal":"Bruno"}
  contato_nome  text,
  contato_email text,
  whatsapp      text,
  portal_token  uuid not null default gen_random_uuid() unique,
  portal_ativo  boolean not null default true,
  updated_at    timestamptz not null default now()
);

-- Quais obrigações cada cliente tem
create table if not exists public.ent_cliente_obrigacoes (
  cliente_id   uuid not null references public.gclik_clientes(id) on delete cascade,
  obrigacao_id uuid not null references public.ent_obrigacoes(id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  responsavel  text,                                          -- sobrepõe o responsável do departamento
  primary key (cliente_id, obrigacao_id)
);

-- Entregas geradas (uma por cliente × obrigação × competência)
create table if not exists public.ent_entregas (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cliente_id    uuid not null references public.gclik_clientes(id) on delete cascade,
  obrigacao_id  uuid references public.ent_obrigacoes(id) on delete set null,
  nome          text not null,
  departamento  text not null default 'Fiscal',
  competencia   text not null,                                -- AAAA-MM
  vencimento    date not null,
  meta          date,
  responsavel   text,
  status        text not null default 'pendente',             -- pendente | entregue | dispensada
  entregue_em   timestamptz,
  entregue_por  text,
  valor         numeric,                                      -- valor da guia, quando houver
  observacoes   text,
  arquivos      jsonb not null default '[]'::jsonb,           -- [{path, nome, tamanho}]
  protocolo     text not null default upper(substr(md5(gen_random_uuid()::text), 1, 10)) unique,
  enviado_em    timestamptz,                                  -- publicado no portal do cliente
  lido_em       timestamptz,                                  -- cliente abriu o documento
  created_at    timestamptz not null default now(),
  unique (cliente_id, obrigacao_id, competencia)
);
create index if not exists ent_entregas_user_venc_idx on public.ent_entregas (user_id, vencimento);
create index if not exists ent_entregas_cliente_idx on public.ent_entregas (cliente_id, competencia);

-- Histórico (auditoria) das entregas
create table if not exists public.ent_historico (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entrega_id  uuid references public.ent_entregas(id) on delete cascade,
  acao        text not null,
  detalhe     text,
  autor       text,
  created_at  timestamptz not null default now()
);
create index if not exists ent_historico_entrega_idx on public.ent_historico (entrega_id, created_at desc);

-- Feriados estaduais / municipais (os nacionais são calculados na tela)
create table if not exists public.ent_feriados (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data     date not null,
  nome     text not null,
  unique (user_id, data)
);

-- Processos (abertura, admissão, rescisão…) com checklist
create table if not exists public.ent_processos_modelos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome         text not null,
  departamento text not null default 'Societário',
  passos       jsonb not null default '[]'::jsonb,            -- [{titulo, prazo_dias, responsavel}]
  created_at   timestamptz not null default now()
);
create table if not exists public.ent_processos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cliente_id   uuid references public.gclik_clientes(id) on delete cascade,
  modelo_id    uuid references public.ent_processos_modelos(id) on delete set null,
  nome         text not null,
  departamento text not null default 'Societário',
  responsavel  text,
  inicio       date not null default current_date,
  prazo        date,
  passos       jsonb not null default '[]'::jsonb,            -- [{titulo, prazo, responsavel, feito, feito_em}]
  status       text not null default 'andamento',            -- andamento | concluido | cancelado
  observacoes  text,
  created_at   timestamptz not null default now()
);

-- RLS: cada usuário só vê e altera o que é seu
do $$
declare t text;
begin
  foreach t in array array['ent_obrigacoes','ent_clientes','ent_cliente_obrigacoes','ent_entregas','ent_historico',
                           'ent_feriados','ent_processos_modelos','ent_processos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_dono', t);
    execute format('create policy %I on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t || '_dono', t);
  end loop;
end $$;

-- Arquivos das entregas: bucket privado, pasta = id do usuário (<user_id>/<entrega_id>/<arquivo>).
-- O cliente baixa pelo portal via Edge Function entregas-portal (URL assinada).
insert into storage.buckets (id, name, public) values ('entregas', 'entregas', false)
on conflict (id) do nothing;

drop policy if exists entregas_arquivos_dono on storage.objects;
create policy entregas_arquivos_dono on storage.objects for all to authenticated
  using (bucket_id = 'entregas' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'entregas' and (storage.foldername(name))[1] = auth.uid()::text);
