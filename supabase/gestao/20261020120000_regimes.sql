-- Regimes tributários cadastráveis — projeto onecnoicxqjhgolqncjj.
-- Usados no JCR Entregas (obrigações por regime) e no cadastro de clientes do Gestão Fiscal.
-- O vínculo continua pelo nome: gclik_clientes.regime e ent_obrigacoes.regimes guardam o nome do regime.

create table if not exists public.ent_regimes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome        text not null,
  descricao   text,
  ordem       int  not null default 0,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (user_id, nome)
);

alter table public.ent_regimes enable row level security;
drop policy if exists ent_regimes_dono on public.ent_regimes;
create policy ent_regimes_dono on public.ent_regimes for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Regimes iniciais para cada usuário que já tem clientes (os que o sistema já usava)
insert into public.ent_regimes (user_id, nome, descricao, ordem)
select u.user_id, r.nome, r.descricao, r.ordem
  from (select distinct user_id from public.gclik_clientes) u
 cross join (values
   ('MEI', 'Microempreendedor individual', 1),
   ('Simples Nacional', 'ME e EPP optantes pelo Simples', 2),
   ('Lucro Presumido', null, 3),
   ('Lucro Real', null, 4),
   ('Imune/Isento', 'Entidades imunes ou isentas', 5)
 ) as r(nome, descricao, ordem)
on conflict (user_id, nome) do nothing;
