-- Alerta diário de prazos: passa a usar o JCR Entregas como fonte única de obrigações.
-- Antes juntava também gclik_tarefas e gclik_obrigacoes, o que duplicava os mesmos prazos.
-- Agora: entregas do JCR Entregas + honorários a receber. Mesma assinatura e mesmo formato de retorno.

create or replace function public.alerta_prazos(dias int default 7)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
  itens as (
    select 'Entrega' as tipo, e.nome, c.razao_social as cliente, e.vencimento, e.responsavel,
           concat_ws(' · ', e.departamento, right(e.competencia, 2) || '/' || left(e.competencia, 4)) as detalhe
      from ent_entregas e left join gclik_clientes c on c.id = e.cliente_id
     where e.status = 'pendente'
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
