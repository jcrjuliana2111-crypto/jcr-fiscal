-- Automações do Societário e do Comercial. Só cria tabelas e funções novas; não altera dados existentes.
--
-- soc_vencimentos ......... certificados digitais, alvarás e licenças com data de vencimento
-- com_pesquisas ........... pesquisa de satisfação (nota 0 a 10) respondida pelo cliente por link
-- pesquisa_ver/responder .. usadas pela página pública comercial/pesquisa.html (só com o código do link)
-- alerta_societario ....... resumo diário para o n8n: processos parados, exigências e vencimentos
-- alerta_comercial ........ resumo diário para o n8n: propostas e contratos parados, implantações e pesquisas
-- registrar_evento_societario  o n8n grava o que leu nos e-mails da JUCESP/REDESIM no processo certo

create table if not exists public.soc_vencimentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cliente_id uuid,
  empresa text not null,
  tipo text not null,                 -- certificado_a1, certificado_a3, alvara, licenca_sanitaria, avcb, conselho, cetesb, procuracao, outro
  descricao text,
  vencimento date not null,
  responsavel text,
  obs text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists soc_vencimentos_user_idx on public.soc_vencimentos (user_id, vencimento);
alter table public.soc_vencimentos enable row level security;
create policy soc_vencimentos_dono on public.soc_vencimentos for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.com_pesquisas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cliente_id uuid,
  cliente_nome text not null,
  token uuid not null unique default gen_random_uuid(),
  enviada_em date not null default (now() at time zone 'America/Sao_Paulo')::date,
  nota int check (nota between 0 and 10),
  comentario text,
  respondida_em timestamptz,
  created_at timestamptz not null default now()
);
alter table public.com_pesquisas enable row level security;
create policy com_pesquisas_dono on public.com_pesquisas for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Página pública da pesquisa: só quem tem o código do link vê o nome do escritório e do cliente
create or replace function public.pesquisa_ver(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('cliente', p.cliente_nome, 'escritorio', coalesce(c.escritorio->>'nome', 'nosso escritório'), 'respondida', p.respondida_em is not null)
    from com_pesquisas p left join com_config c on c.user_id = p.user_id
   where p.token = p_token;
$$;
create or replace function public.pesquisa_responder(p_token uuid, p_nota int, p_comentario text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_nota is null or p_nota < 0 or p_nota > 10 then return false; end if;
  update com_pesquisas set nota = p_nota, comentario = left(nullif(trim(p_comentario), ''), 2000), respondida_em = now()
   where token = p_token and respondida_em is null;
  return found;
end $$;
revoke all on function public.pesquisa_ver(uuid) from public;
revoke all on function public.pesquisa_responder(uuid, int, text) from public;
grant execute on function public.pesquisa_ver(uuid) to anon, authenticated;
grant execute on function public.pesquisa_responder(uuid, int, text) to anon, authenticated;

create or replace function public.alerta_societario(dias int default 30)
returns jsonb language sql stable security definer set search_path = public as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
  procs as (
    select p.id, p.empresa, p.tipo, p.status, p.responsavel, p.exigencia_em, p.exigencia_motivo,
           greatest(p.iniciado_em, coalesce((select max((e->>'data')::date) from jsonb_array_elements(coalesce(p.etapas, '[]'::jsonb)) e
                                             where (e->>'feito')::boolean and e->>'data' is not null), p.iniciado_em)) as ultimo,
           (select e->>'nome' from jsonb_array_elements(coalesce(p.etapas, '[]'::jsonb)) e where not coalesce((e->>'feito')::boolean, false) limit 1) as proxima
      from soc_processos p where coalesce(p.status, 'andamento') not in ('concluido', 'cancelado')
  )
  select jsonb_build_object(
    'data', (select d from hoje),
    'exigencias', coalesce((select jsonb_agg(jsonb_build_object('empresa', empresa, 'tipo', tipo, 'motivo', exigencia_motivo, 'responsavel', responsavel,
        'prazo', exigencia_em + 30, 'dias_restantes', exigencia_em + 30 - (select d from hoje)) order by exigencia_em)
        from procs where status = 'exigencia' and exigencia_em is not null), '[]'::jsonb),
    'parados', coalesce((select jsonb_agg(jsonb_build_object('empresa', empresa, 'tipo', tipo, 'responsavel', responsavel, 'proxima', proxima,
        'dias_parado', (select d from hoje) - ultimo) order by ultimo)
        from procs where status <> 'exigencia' and (select d from hoje) - ultimo > 7), '[]'::jsonb),
    'vencimentos', coalesce((select jsonb_agg(jsonb_build_object('empresa', v.empresa, 'tipo', v.tipo, 'descricao', v.descricao, 'vencimento', v.vencimento,
        'responsavel', v.responsavel, 'dias_restantes', v.vencimento - (select d from hoje)) order by v.vencimento)
        from soc_vencimentos v where v.vencimento <= (select d from hoje) + dias), '[]'::jsonb)
  );
$$;

create or replace function public.alerta_comercial()
returns jsonb language sql stable security definer set search_path = public as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
  ops as (select o.*, (select d from hoje) - (o.updated_at at time zone 'America/Sao_Paulo')::date as parado from com_oportunidades o)
  select jsonb_build_object(
    'data', (select d from hoje),
    'retornos', coalesce((select jsonb_agg(jsonb_build_object('nome', nome, 'etapa', etapa, 'dias_parado', parado, 'mensal', orcamento->>'mensal',
        'contato', dados->>'contato', 'whatsapp', dados->>'whatsapp', 'email', dados->>'email', 'responsavel', dados->>'responsavel',
        'motivo', case etapa when 'lead' then 'qualificar e orçar' when 'orcamento' then 'enviar a proposta' when 'proposta' then 'retorno da proposta'
                              when 'contrato' then 'colher a assinatura do contrato' else 'implantação parada' end) order by parado desc)
        from ops where (etapa in ('lead', 'orcamento') and parado >= 2) or (etapa in ('proposta', 'contrato') and parado >= 3) or (etapa = 'implantacao' and parado >= 7)), '[]'::jsonb),
    'pesquisas_sem_resposta', (select count(*) from com_pesquisas where respondida_em is null and enviada_em <= (select d from hoje) - 7),
    'notas_baixas', coalesce((select jsonb_agg(jsonb_build_object('cliente', cliente_nome, 'nota', nota, 'comentario', comentario))
        from com_pesquisas where nota <= 6 and respondida_em >= now() - interval '1 day'), '[]'::jsonb)
  );
$$;

-- Evento lido do e-mail da JUCESP/REDESIM: acha o processo pelo protocolo e atualiza situação e etapas
create or replace function public.registrar_evento_societario(p_protocolo text, p_evento text, p_texto text default null, p_data date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_etapa text; v_dia date := coalesce(p_data, (now() at time zone 'America/Sao_Paulo')::date);
  v_prot text := regexp_replace(coalesce(p_protocolo, ''), '\D', '', 'g');
begin
  if length(v_prot) < 6 then return jsonb_build_object('ok', false, 'erro', 'protocolo inválido'); end if;
  select id into v_id from soc_processos
   where regexp_replace(coalesce(protocolo, ''), '\D', '', 'g') = v_prot or regexp_replace(coalesce(protocolo_redesim, ''), '\D', '', 'g') = v_prot
   order by updated_at desc limit 1;
  if v_id is null then return jsonb_build_object('ok', false, 'erro', 'processo não encontrado', 'protocolo', p_protocolo); end if;
  if p_evento in ('exigencia', 'indeferido') then
    update soc_processos set status = 'exigencia', exigencia_em = v_dia, exigencia_motivo = left(coalesce(p_texto, 'Exigência (e-mail)'), 1000),
           obs = concat_ws(E'\n', obs, to_char(v_dia, 'DD/MM/YYYY') || ' — e-mail: ' || p_evento), updated_at = now() where id = v_id;
  else
    v_etapa := case p_evento when 'deferido' then 'deferimento' when 'cnpj' then 'deferimento' when 'vicio_ok' then 'vicio' else null end;
    update soc_processos set
      status = case when status = 'exigencia' and p_evento = 'deferido' then 'andamento' else status end,
      etapas = case when v_etapa is null then etapas else
        coalesce((select jsonb_agg(case when e->>'id' = v_etapa then e || jsonb_build_object('feito', true, 'data', v_dia) else e end) from jsonb_array_elements(coalesce(etapas, '[]'::jsonb)) e), etapas) end,
      obs = concat_ws(E'\n', obs, to_char(v_dia, 'DD/MM/YYYY') || ' — e-mail: ' || p_evento || coalesce(' (' || left(p_texto, 200) || ')', '')),
      updated_at = now()
     where id = v_id;
  end if;
  return jsonb_build_object('ok', true, 'processo', v_id, 'evento', p_evento);
end $$;

revoke all on function public.alerta_societario(int) from public, anon, authenticated;
revoke all on function public.alerta_comercial() from public, anon, authenticated;
revoke all on function public.registrar_evento_societario(text, text, text, date) from public, anon, authenticated;
grant execute on function public.alerta_societario(int) to service_role;
grant execute on function public.alerta_comercial() to service_role;
grant execute on function public.registrar_evento_societario(text, text, text, date) to service_role;
