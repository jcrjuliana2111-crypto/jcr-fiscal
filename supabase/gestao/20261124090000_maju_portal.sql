-- Maju (n8n) ligada ao Portal JCR
-- Duas funções, só para a chave service role (a do n8n). A chave pública do site não tem acesso.
--   maju_consultar(modulo, filtros) → leitura de todos os módulos do Portal
--   maju_registrar(acao, dados)     → ações pontuais pedidas pela Ju (a Maju pede confirmação antes)
-- Tudo o que a Maju grava fica marcado como "Maju" e com histórico.

create or replace function public.maju_consultar(p_modulo text, p_filtros jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  f jsonb := coalesce(p_filtros, '{}'::jsonb);
  v_cli text := nullif(trim(coalesce(f->>'cliente', '')), '');
  v_status text := nullif(lower(trim(coalesce(f->>'status', ''))), '');
  v_de date := nullif(f->>'de', '')::date;
  v_ate date := nullif(f->>'ate', '')::date;
  v_resp text := nullif(trim(coalesce(f->>'responsavel', '')), '');
  v_busca text := nullif(trim(coalesce(f->>'busca', '')), '');
  v_lim int := least(greatest(coalesce(nullif(f->>'limite', '')::int, 60), 1), 200);
  r jsonb;
begin
  case lower(coalesce(p_modulo, 'resumo'))

  when 'resumo' then
    select jsonb_build_object(
      'hoje', hoje,
      'entregas_pendentes', (select count(*) from ent_entregas where status = 'pendente'),
      'entregas_atrasadas', (select count(*) from ent_entregas where status = 'pendente' and vencimento < hoje),
      'pagar_em_aberto', (select count(*) from fin_lancamentos where tipo = 'pagar' and status = 'aberto'),
      'pagar_vencidas', (select count(*) from fin_lancamentos where tipo = 'pagar' and status = 'aberto' and vencimento < hoje),
      'pagar_proximos_7_dias_valor', (select coalesce(sum(valor), 0) from fin_lancamentos where tipo = 'pagar' and status = 'aberto' and vencimento between hoje and hoje + 7),
      'honorarios_pendentes', (select count(*) from gclik_honorarios where coalesce(status, '') not in ('Pago', 'Recebido', 'Cancelado')),
      'honorarios_pendentes_valor', (select coalesce(sum(valor), 0) from gclik_honorarios where coalesce(status, '') not in ('Pago', 'Recebido', 'Cancelado')),
      'societario_em_andamento', (select count(*) from soc_processos where status not in ('concluido', 'cancelado')),
      'societario_em_exigencia', (select count(*) from soc_processos where status = 'exigencia'),
      'vencimentos_30_dias', (select count(*) from soc_vencimentos where vencimento between hoje and hoje + 30),
      'tarefas_abertas', (select count(*) from gclik_tarefas where coalesce(status, '') not in ('concluida', 'Concluída', 'feito')),
      'processos_abertos', (select count(*) from ent_processos where coalesce(status, '') not in ('concluido', 'cancelado')),
      'oportunidades_abertas', (select count(*) from com_oportunidades where coalesce(etapa, '') not in ('ganho', 'perdido', 'implantado'))
    ) into r;
    return jsonb_build_object('modulo', 'resumo', 'dados', r);

  when 'entregas' then
    select coalesce(jsonb_agg(x order by x->>'vencimento'), '[]') into r from (
      select jsonb_build_object('id', e.id, 'cliente', coalesce(c.nome_fantasia, c.razao_social), 'obrigacao', e.nome,
        'departamento', e.departamento, 'competencia', e.competencia, 'vencimento', e.vencimento, 'meta', e.meta,
        'responsavel', e.responsavel, 'status', e.status, 'atrasada', (e.status = 'pendente' and e.vencimento < hoje),
        'entregue_em', e.entregue_em, 'protocolo', e.protocolo) x
      from ent_entregas e left join gclik_clientes c on c.id = e.cliente_id
      where (v_cli is null or coalesce(c.nome_fantasia, '') || ' ' || coalesce(c.razao_social, '') || ' ' || coalesce(c.cnpj, '') ilike '%' || v_cli || '%')
        and (v_status is null or (v_status = 'atrasada' and e.status = 'pendente' and e.vencimento < hoje) or lower(e.status) = v_status)
        and (v_de is null or e.vencimento >= v_de) and (v_ate is null or e.vencimento <= v_ate)
        and (v_resp is null or e.responsavel ilike '%' || v_resp || '%')
        and (v_busca is null or e.nome ilike '%' || v_busca || '%' or e.departamento ilike '%' || v_busca || '%')
      order by e.vencimento limit v_lim) s;

  when 'financeiro' then
    select coalesce(jsonb_agg(x order by x->>'vencimento'), '[]') into r from (
      select jsonb_build_object('id', l.id, 'tipo', l.tipo, 'descricao', l.descricao, 'fornecedor', l.fornecedor,
        'categoria', cat.nome, 'competencia', l.competencia, 'vencimento', l.vencimento, 'valor', l.valor, 'status', l.status,
        'vencida', (l.status = 'aberto' and l.vencimento < hoje), 'data_pagamento', l.data_pagamento, 'valor_pago', l.valor_pago,
        'parcela', l.parcela) x
      from fin_lancamentos l left join fin_categorias cat on cat.id = l.categoria_id
      where (v_cli is null or coalesce(l.fornecedor, '') || ' ' || coalesce(l.descricao, '') ilike '%' || v_cli || '%')
        and (v_status is null or (v_status = 'vencida' and l.status = 'aberto' and l.vencimento < hoje) or lower(l.status) = v_status)
        and (f->>'tipo' is null or l.tipo = f->>'tipo')
        and (v_de is null or l.vencimento >= v_de) and (v_ate is null or l.vencimento <= v_ate)
        and (v_busca is null or coalesce(l.descricao, '') || ' ' || coalesce(cat.nome, '') ilike '%' || v_busca || '%')
      order by l.vencimento limit v_lim) s;

  when 'honorarios' then
    select coalesce(jsonb_agg(x order by x->>'vencimento'), '[]') into r from (
      select jsonb_build_object('id', h.id, 'cliente', coalesce(h.nome_cliente, c.razao_social), 'servico', coalesce(h.servico, h.tipo),
        'competencia', h.competencia, 'vencimento', h.vencimento, 'valor', h.valor, 'status', h.status,
        'atrasado', (coalesce(h.status, '') not in ('Pago', 'Recebido', 'Cancelado') and h.vencimento < hoje),
        'data_pagamento', h.data_pagamento, 'forma', h.forma) x
      from gclik_honorarios h left join gclik_clientes c on c.id = h.cliente_id
      where (v_cli is null or coalesce(h.nome_cliente, '') || ' ' || coalesce(c.razao_social, '') ilike '%' || v_cli || '%')
        and (v_status is null or (v_status = 'pendente' and coalesce(h.status, '') not in ('Pago', 'Recebido', 'Cancelado')) or lower(h.status) = v_status)
        and (v_de is null or h.vencimento >= v_de) and (v_ate is null or h.vencimento <= v_ate)
      order by h.vencimento limit v_lim) s;

  when 'societario' then
    select coalesce(jsonb_agg(x order by x->>'atualizado' desc), '[]') into r from (
      select jsonb_build_object('id', p.id, 'empresa', p.empresa, 'tipo', p.tipo, 'natureza', p.natureza, 'status', p.status,
        'responsavel', p.responsavel, 'protocolo', p.protocolo, 'municipio', p.municipio, 'exigencia_em', p.exigencia_em,
        'prazo_exigencia', case when p.exigencia_em is not null then p.exigencia_em + 30 end, 'exigencia_motivo', p.exigencia_motivo,
        'iniciado_em', p.iniciado_em, 'concluido_em', p.concluido_em, 'atualizado', p.updated_at,
        'etapas_pendentes', (select jsonb_agg(e->>'nome') from jsonb_array_elements(coalesce(p.etapas, '[]')) e where coalesce((e->>'feito')::boolean, false) = false),
        'obs', right(coalesce(p.obs, ''), 600)) x
      from soc_processos p
      where (v_cli is null or p.empresa ilike '%' || v_cli || '%')
        and (v_status is null or lower(p.status) = v_status or (v_status = 'aberto' and p.status not in ('concluido', 'cancelado')))
        and (v_resp is null or p.responsavel ilike '%' || v_resp || '%')
      order by p.updated_at desc limit v_lim) s;

  when 'vencimentos' then
    select coalesce(jsonb_agg(x order by x->>'vencimento'), '[]') into r from (
      select jsonb_build_object('id', v.id, 'empresa', v.empresa, 'cnpj', v.cnpj, 'tipo', v.tipo, 'descricao', v.descricao,
        'vencimento', v.vencimento, 'dias_para_vencer', v.vencimento - hoje, 'responsavel', v.responsavel, 'titular', v.titular) x
      from soc_vencimentos v
      where (v_cli is null or coalesce(v.empresa, '') || ' ' || coalesce(v.cnpj, '') || ' ' || coalesce(v.titular, '') ilike '%' || v_cli || '%')
        and (v_de is null or v.vencimento >= v_de) and (v_ate is null or v.vencimento <= v_ate)
        and (v_busca is null or coalesce(v.tipo, '') || ' ' || coalesce(v.descricao, '') ilike '%' || v_busca || '%')
      order by v.vencimento limit v_lim) s;

  when 'tarefas' then
    select coalesce(jsonb_agg(x order by x->>'prazo'), '[]') into r from (
      select jsonb_build_object('id', t.id, 'origem', 'tarefa', 'cliente', coalesce(c.nome_fantasia, c.razao_social), 'titulo', t.titulo,
        'descricao', t.descricao, 'responsavel', t.responsavel, 'prazo', t.prazo, 'prioridade', t.prioridade, 'status', t.status) x
      from gclik_tarefas t left join gclik_clientes c on c.id = t.cliente_id
      where (v_cli is null or coalesce(c.nome_fantasia, '') || ' ' || coalesce(c.razao_social, '') ilike '%' || v_cli || '%')
        and (v_status is null or lower(coalesce(t.status, '')) = v_status or (v_status = 'aberta' and coalesce(t.status, '') not in ('concluida', 'Concluída', 'feito')))
        and (v_resp is null or t.responsavel ilike '%' || v_resp || '%')
      union all
      select jsonb_build_object('id', pr.id, 'origem', 'processo', 'cliente', coalesce(c.nome_fantasia, c.razao_social), 'titulo', pr.nome,
        'descricao', pr.departamento, 'responsavel', pr.responsavel, 'prazo', pr.prazo, 'prioridade', null, 'status', pr.status,
        'passos_pendentes', (select jsonb_agg(e->>'nome') from jsonb_array_elements(coalesce(pr.passos, '[]')) e where coalesce((e->>'feito')::boolean, false) = false))
      from ent_processos pr left join gclik_clientes c on c.id = pr.cliente_id
      where (v_cli is null or coalesce(c.nome_fantasia, '') || ' ' || coalesce(c.razao_social, '') ilike '%' || v_cli || '%')
        and (v_resp is null or pr.responsavel ilike '%' || v_resp || '%')
      limit v_lim) s;

  when 'comercial' then
    select coalesce(jsonb_agg(x), '[]') into r from (
      select jsonb_build_object('id', o.id, 'nome', o.nome, 'etapa', o.etapa, 'data_proposta', o.data_proposta,
        'perdido_motivo', o.perdido_motivo, 'atualizado', o.updated_at) x
      from com_oportunidades o
      where (v_cli is null or o.nome ilike '%' || v_cli || '%')
        and (v_status is null or lower(coalesce(o.etapa, '')) = v_status)
      order by o.updated_at desc limit v_lim) s;

  when 'clientes' then
    select coalesce(jsonb_agg(x), '[]') into r from (
      select jsonb_build_object('id', c.id, 'razao_social', c.razao_social, 'nome_fantasia', c.nome_fantasia, 'cnpj', c.cnpj,
        'regime', c.regime, 'status', c.status, 'responsavel', c.responsavel, 'email', c.email, 'telefone', c.telefone,
        'cidade', c.cidade, 'estado', c.estado, 'honorario_mensal', c.honor_mensal, 'dia_vencimento', c.dia_vencimento,
        'obrigacoes', (select jsonb_agg(o.nome) from ent_cliente_obrigacoes co join ent_obrigacoes o on o.id = co.obrigacao_id where co.cliente_id = c.id)) x
      from gclik_clientes c
      where (v_cli is null or coalesce(c.nome_fantasia, '') || ' ' || coalesce(c.razao_social, '') || ' ' || coalesce(c.cnpj, '') ilike '%' || v_cli || '%')
      order by c.razao_social limit v_lim) s;

  else
    return jsonb_build_object('erro', 'módulo desconhecido', 'modulos',
      jsonb_build_array('resumo', 'entregas', 'financeiro', 'honorarios', 'societario', 'vencimentos', 'tarefas', 'comercial', 'clientes'));
  end case;

  return jsonb_build_object('modulo', lower(p_modulo), 'hoje', hoje, 'filtros', f, 'total', jsonb_array_length(r), 'itens', r);
end $$;


create or replace function public.maju_registrar(p_acao text, p_dados jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d jsonb := coalesce(p_dados, '{}'::jsonb);
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_uid uuid;
  v_id uuid;
  v_cli uuid;
  v_txt text;
  n int;
begin
  -- dono dos registros: o usuário do escritório (o mesmo das telas do Portal)
  select user_id into v_uid from fin_lancamentos where user_id is not null group by user_id order by count(*) desc limit 1;

  case lower(coalesce(p_acao, ''))

  when 'baixar_entrega' then
    v_id := (d->>'id')::uuid;
    update ent_entregas set status = 'entregue', entregue_em = now(), entregue_por = 'Maju (a pedido da Ju)',
           protocolo = coalesce(nullif(d->>'protocolo', ''), protocolo),
           observacoes = concat_ws(E'\n', observacoes, nullif(d->>'obs', ''))
     where id = v_id and status <> 'entregue';
    get diagnostics n = row_count;
    if n = 0 then return jsonb_build_object('ok', false, 'erro', 'entrega não encontrada ou já entregue'); end if;
    insert into ent_historico (user_id, entrega_id, acao, detalhe, autor)
    values (v_uid, v_id, 'entregue', coalesce(nullif(d->>'obs', ''), 'Baixa pela Maju'), 'Maju');
    return jsonb_build_object('ok', true, 'acao', 'baixar_entrega', 'id', v_id);

  when 'pagar_lancamento' then
    v_id := (d->>'id')::uuid;
    update fin_lancamentos set status = 'pago',
           data_pagamento = coalesce(nullif(d->>'data_pagamento', '')::date, hoje),
           valor_pago = coalesce(nullif(d->>'valor_pago', '')::numeric, valor),
           observacoes = concat_ws(E'\n', observacoes, 'Baixa pela Maju em ' || to_char(hoje, 'DD/MM/YYYY'))
     where id = v_id and status = 'aberto';
    get diagnostics n = row_count;
    if n = 0 then return jsonb_build_object('ok', false, 'erro', 'lançamento não encontrado ou já pago'); end if;
    return jsonb_build_object('ok', true, 'acao', 'pagar_lancamento', 'id', v_id);

  when 'receber_honorario' then
    v_id := (d->>'id')::uuid;
    update gclik_honorarios set status = 'Pago',
           data_pagamento = coalesce(nullif(d->>'data_pagamento', '')::date, hoje),
           forma = coalesce(nullif(d->>'forma', ''), forma),
           obs = concat_ws(E'\n', obs, 'Recebimento registrado pela Maju em ' || to_char(hoje, 'DD/MM/YYYY'))
     where id = v_id and coalesce(status, '') not in ('Pago', 'Recebido', 'Cancelado');
    get diagnostics n = row_count;
    if n = 0 then return jsonb_build_object('ok', false, 'erro', 'honorário não encontrado ou já pago'); end if;
    return jsonb_build_object('ok', true, 'acao', 'receber_honorario', 'id', v_id);

  when 'criar_tarefa' then
    if nullif(trim(coalesce(d->>'titulo', '')), '') is null then return jsonb_build_object('ok', false, 'erro', 'título obrigatório'); end if;
    if nullif(d->>'cliente', '') is not null then
      select id into v_cli from gclik_clientes
       where coalesce(nome_fantasia, '') || ' ' || coalesce(razao_social, '') || ' ' || coalesce(cnpj, '') ilike '%' || (d->>'cliente') || '%'
       order by razao_social limit 1;
    end if;
    insert into gclik_tarefas (user_id, cliente_id, titulo, descricao, responsavel, prazo, prioridade, status)
    values (v_uid, v_cli, d->>'titulo', concat_ws(E'\n', nullif(d->>'descricao', ''), 'Criada pela Maju'),
            nullif(d->>'responsavel', ''), nullif(d->>'prazo', '')::date, coalesce(nullif(d->>'prioridade', ''), 'Média'), 'Pendente')
    returning id into v_id;
    return jsonb_build_object('ok', true, 'acao', 'criar_tarefa', 'id', v_id, 'cliente_encontrado', v_cli is not null);

  when 'concluir_tarefa' then
    v_id := (d->>'id')::uuid;
    update gclik_tarefas set status = 'Concluída' where id = v_id and coalesce(status, '') not in ('concluida', 'Concluída');
    get diagnostics n = row_count;
    return jsonb_build_object('ok', n > 0, 'acao', 'concluir_tarefa', 'id', v_id);

  when 'anotar_societario' then
    v_id := (d->>'id')::uuid;
    v_txt := nullif(trim(coalesce(d->>'texto', '')), '');
    if v_txt is null then return jsonb_build_object('ok', false, 'erro', 'texto obrigatório'); end if;
    update soc_processos set obs = concat_ws(E'\n', obs, to_char(hoje, 'DD/MM/YYYY') || ' — Maju: ' || left(v_txt, 1000)), updated_at = now()
     where id = v_id;
    get diagnostics n = row_count;
    return jsonb_build_object('ok', n > 0, 'acao', 'anotar_societario', 'id', v_id);

  else
    return jsonb_build_object('ok', false, 'erro', 'ação desconhecida', 'acoes',
      jsonb_build_array('baixar_entrega', 'pagar_lancamento', 'receber_honorario', 'criar_tarefa', 'concluir_tarefa', 'anotar_societario'));
  end case;
end $$;

revoke all on function public.maju_consultar(text, jsonb) from public, anon, authenticated;
revoke all on function public.maju_registrar(text, jsonb) from public, anon, authenticated;
grant execute on function public.maju_consultar(text, jsonb) to service_role;
grant execute on function public.maju_registrar(text, jsonb) to service_role;
