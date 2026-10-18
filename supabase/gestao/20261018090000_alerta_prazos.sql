-- Alerta diário de prazos (n8n) — projeto Supabase onecnoicxqjhgolqncjj.
-- Junta, num só JSON, o que está atrasado e o que vence nos próximos dias:
-- tarefas e obrigações do Gestão Fiscal, entregas do JCR Entregas e honorários a receber.
--
-- Só leitura. Só o service_role (a chave guardada no n8n) pode executar: a chave
-- pública do site (anon) e os usuários logados não têm acesso.
--
-- Uso no n8n: POST {SUPABASE_URL}/rest/v1/rpc/alerta_prazos  body {"dias": 7}

create or replace function public.alerta_prazos(dias int default 7)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
  itens as (
    select 'Tarefa' as tipo, t.titulo as nome, c.razao_social as cliente,
           t.prazo as vencimento, t.responsavel, t.prioridade as detalhe
      from gclik_tarefas t left join gclik_clientes c on c.id = t.cliente_id
     where coalesce(t.status, '') not in ('Concluída', 'Concluida', 'Concluído', 'Entregue', 'Cancelada')
       and t.prazo is not null
    union all
    select 'Obrigação', o.titulo, c.razao_social, o.vencimento, null, o.competencia
      from gclik_obrigacoes o left join gclik_clientes c on c.id = o.cliente_id
     where coalesce(o.status, '') not in ('Concluída', 'Concluida', 'Concluído', 'Entregue', 'Cancelada')
       and o.vencimento is not null
    union all
    select 'Entrega', e.nome, c.razao_social, e.vencimento, e.responsavel, e.competencia
      from ent_entregas e left join gclik_clientes c on c.id = e.cliente_id
     where coalesce(e.status, '') not in ('entregue', 'dispensada', 'Entregue', 'Dispensada')
       and e.vencimento is not null
    union all
    select 'Honorário', coalesce(h.servico, h.tipo, 'Honorário'), coalesce(h.nome_cliente, c.razao_social),
           h.vencimento, null, h.valor::text
      from gclik_honorarios h left join gclik_clientes c on c.id = h.cliente_id
     where coalesce(h.status, '') not in ('Pago', 'Recebido', 'Cancelado')
       and h.vencimento is not null
  ),
  marcados as (
    select i.*, (i.vencimento - h.d) as dias_restantes,
           case when i.vencimento < h.d then 'atrasado'
                when i.vencimento = h.d then 'hoje'
                else 'proximos' end as grupo
      from itens i, hoje h
     where i.vencimento <= h.d + dias
  )
  select jsonb_build_object(
    'data', (select d from hoje),
    'dias', dias,
    'totais', jsonb_build_object(
      'atrasado', (select count(*) from marcados where grupo = 'atrasado'),
      'hoje',     (select count(*) from marcados where grupo = 'hoje'),
      'proximos', (select count(*) from marcados where grupo = 'proximos')),
    'itens', coalesce((select jsonb_agg(to_jsonb(m) order by m.vencimento, m.tipo, m.cliente) from marcados m), '[]'::jsonb)
  );
$$;

revoke all on function public.alerta_prazos(int) from public, anon, authenticated;
grant execute on function public.alerta_prazos(int) to service_role;
