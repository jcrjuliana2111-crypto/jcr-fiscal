-- Financeiro do escritório (JCR) — projeto onecnoicxqjhgolqncjj.
-- Só as contas da própria JCR. Não tem ligação com o Conta Azul nem com o BPO Financeiro.
-- Receitas de honorários vêm de gclik_honorarios (escritório JCR); aqui ficam as contas
-- a pagar, outras receitas, as categorias (com a linha da DRE) e as contas bancárias.

-- Categorias: cada uma cai numa linha da DRE (grupo_dre)
--   receita | deducao | custo | pessoal | administrativa | comercial
--   financeira_receita | financeira_despesa | ir | fora_dre (só caixa: investimentos, lucros, empréstimos)
create table if not exists public.fin_categorias (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome       text not null,
  tipo       text not null default 'despesa',   -- despesa | receita
  grupo_dre  text not null default 'administrativa',
  ordem      int  not null default 0,
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, nome)
);

create table if not exists public.fin_contas_bancarias (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome          text not null,
  saldo_inicial numeric(14,2) not null default 0,
  data_saldo    date not null default current_date,   -- movimentos a partir desta data entram no saldo
  ativo         boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Lançamentos: contas a pagar (tipo pagar) e outras receitas (tipo receber)
create table if not exists public.fin_lancamentos (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo           text not null default 'pagar',          -- pagar | receber
  descricao      text not null,
  fornecedor     text,
  categoria_id   uuid references public.fin_categorias(id) on delete set null,
  competencia    text not null,                          -- AAAA-MM (DRE por competência)
  vencimento     date not null,
  valor          numeric(14,2) not null,
  status         text not null default 'aberto',         -- aberto | pago | cancelado
  data_pagamento date,
  valor_pago     numeric(14,2),
  conta_id       uuid references public.fin_contas_bancarias(id) on delete set null,
  forma          text,                                   -- PIX, boleto, cartão, débito…
  grupo          uuid,                                   -- mesma conta repetida (recorrência)
  parcela        text,                                   -- ex.: 3/12
  observacoes    text,
  created_at     timestamptz not null default now()
);
create index if not exists fin_lancamentos_venc on public.fin_lancamentos (user_id, vencimento);

alter table public.fin_categorias enable row level security;
alter table public.fin_contas_bancarias enable row level security;
alter table public.fin_lancamentos enable row level security;
create policy fin_categorias_dono on public.fin_categorias for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy fin_contas_bancarias_dono on public.fin_contas_bancarias for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy fin_lancamentos_dono on public.fin_lancamentos for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Categorias iniciais (editáveis na tela) para quem já usa o Gestão Fiscal
insert into public.fin_categorias (user_id, nome, tipo, grupo_dre, ordem)
select u.user_id, c.nome, c.tipo, c.grupo, c.ordem
  from (select distinct user_id from public.gclik_clientes) u
 cross join (values
   ('Outras receitas de serviços',      'receita', 'receita',            1),
   ('Rendimentos de aplicações',        'receita', 'financeira_receita', 2),
   ('Simples Nacional (DAS)',           'despesa', 'deducao',           10),
   ('ISS',                              'despesa', 'deducao',           11),
   ('Serviços terceirizados',           'despesa', 'custo',             20),
   ('Salários e encargos',              'despesa', 'pessoal',           30),
   ('Pró-labore',                       'despesa', 'pessoal',           31),
   ('Benefícios',                       'despesa', 'pessoal',           32),
   ('Aluguel e condomínio',             'despesa', 'administrativa',    40),
   ('Energia, água e internet',         'despesa', 'administrativa',    41),
   ('Telefone',                         'despesa', 'administrativa',    42),
   ('Sistemas e softwares',             'despesa', 'administrativa',    43),
   ('Certificado digital',              'despesa', 'administrativa',    44),
   ('Material de escritório',           'despesa', 'administrativa',    45),
   ('Cursos e treinamentos',            'despesa', 'administrativa',    46),
   ('Outras despesas administrativas',  'despesa', 'administrativa',    49),
   ('Marketing e publicidade',          'despesa', 'comercial',         50),
   ('Tarifas bancárias',                'despesa', 'financeira_despesa',60),
   ('Juros e multas',                   'despesa', 'financeira_despesa',61),
   ('IRPJ e CSLL',                      'despesa', 'ir',                70),
   ('Investimentos e equipamentos',     'despesa', 'fora_dre',          80),
   ('Distribuição de lucros',           'despesa', 'fora_dre',          81)
 ) as c(nome, tipo, grupo, ordem)
on conflict (user_id, nome) do nothing;
