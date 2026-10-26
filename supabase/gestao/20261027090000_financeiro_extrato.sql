-- Financeiro JCR — importação de extrato bancário (OFX/CSV). Projeto onecnoicxqjhgolqncjj.
-- Só o financeiro do escritório; nada de Conta Azul.

-- Cada movimento do extrato já tratado (importado ou ignorado): impede importar duas vezes.
create table if not exists public.fin_extrato_movs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  conta_id   uuid references public.fin_contas_bancarias(id) on delete set null,
  chave      text not null,               -- conta + FITID do OFX (ou data|valor|histórico)
  data       date not null,
  valor      numeric(14,2) not null,      -- positivo = entrada, negativo = saída
  historico  text,
  destino    text not null,               -- lancamento | honorario | ignorado
  ref_id     uuid,                        -- fin_lancamentos.id ou gclik_honorarios.id
  created_at timestamptz not null default now(),
  unique (user_id, chave)
);

-- Categoria aprendida pelo texto do extrato ("PIX ENEL" → Energia, água e internet)
create table if not exists public.fin_regras (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  chave        text not null,
  categoria_id uuid references public.fin_categorias(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (user_id, chave)
);

alter table public.fin_extrato_movs enable row level security;
alter table public.fin_regras enable row level security;
create policy fin_extrato_movs_dono on public.fin_extrato_movs for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy fin_regras_dono on public.fin_regras for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Categorias para transferências entre contas e aplicações/resgates: entram no caixa, ficam fora da DRE
insert into public.fin_categorias (user_id, nome, tipo, grupo_dre, ordem)
select u.user_id, c.nome, c.tipo, 'fora_dre', c.ordem
  from (select distinct user_id from public.gclik_clientes) u
 cross join (values ('Transferências e aplicações','despesa',82), ('Transferências e resgates recebidos','receita',83)) as c(nome, tipo, ordem)
on conflict (user_id, nome) do nothing;
