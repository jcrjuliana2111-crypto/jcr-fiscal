-- Certificados digitais: importação em lote no portal e conversa com o robô da VPS (n8n).
-- Só acrescenta colunas e funções; não altera nem apaga dados. Senha e arquivo NÃO ficam no banco
-- (ficam só na VPS, onde o robô de notas fiscais já usa).
alter table public.soc_vencimentos add column if not exists cnpj text;          -- CNPJ ou CPF do titular, só números
alter table public.soc_vencimentos add column if not exists titular text;       -- nome do certificado (CN)
alter table public.soc_vencimentos add column if not exists emitido_em date;
alter table public.soc_vencimentos add column if not exists arquivo text;       -- nome do arquivo na VPS
alter table public.soc_vencimentos add column if not exists origem text;        -- portal | vps
alter table public.soc_vencimentos add column if not exists na_vps_em timestamptz; -- quando o arquivo foi gravado na VPS
create index if not exists soc_vencimentos_cnpj_idx on public.soc_vencimentos (cnpj) where cnpj is not null;

-- O robô da VPS avisa o portal quando salva um certificado novo (chave service role, só no n8n).
-- Atualiza o certificado A1 do mesmo CNPJ ou cria um novo; liga ao cliente do Gestão Fiscal pelo CNPJ.
create or replace function public.registrar_certificado(p_documento text, p_titular text, p_vencimento date,
  p_arquivo text default null, p_emitido date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_doc text := regexp_replace(coalesce(p_documento, ''), '\D', '', 'g');
  v_dono uuid; v_cli record; v_id uuid;
begin
  if length(v_doc) not in (11, 14) or p_vencimento is null then return jsonb_build_object('ok', false, 'erro', 'documento ou vencimento inválido'); end if;
  select user_id into v_dono from soc_vencimentos order by created_at limit 1;
  if v_dono is null then select id into v_dono from auth.users order by created_at limit 1; end if;
  select id, razao_social into v_cli from gclik_clientes where regexp_replace(coalesce(cnpj, ''), '\D', '', 'g') = v_doc limit 1;
  update soc_vencimentos set vencimento = p_vencimento, titular = coalesce(p_titular, titular), arquivo = coalesce(p_arquivo, arquivo),
         emitido_em = coalesce(p_emitido, emitido_em), na_vps_em = now(), cliente_id = coalesce(cliente_id, v_cli.id), updated_at = now()
   where cnpj = v_doc and tipo = 'certificado_a1' returning id into v_id;
  if v_id is null then
    insert into soc_vencimentos (user_id, cliente_id, empresa, tipo, descricao, vencimento, cnpj, titular, emitido_em, arquivo, origem, na_vps_em)
    values (v_dono, v_cli.id, coalesce(v_cli.razao_social, split_part(p_titular, ':', 1), v_doc), 'certificado_a1',
            (case when length(v_doc) = 14 then 'e-CNPJ' else 'e-CPF' end) || ' A1 — ' || coalesce(p_titular, ''), p_vencimento, v_doc, p_titular, p_emitido, p_arquivo, 'vps', now())
    returning id into v_id;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id, 'cliente', v_cli.razao_social);
end $$;

-- Certificados que completam hoje um dos marcos (ex.: 60, 45, 30, 15, 7, 1, 0 dias) e os vencidos
-- (lembrete semanal), com o contato do cliente para o aviso.
create or replace function public.certificados_alerta(marcos int[] default array[60, 45, 30, 15, 7, 1, 0])
returns jsonb language sql stable security definer set search_path = public as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d)
  select jsonb_build_object('data', (select d from hoje), 'itens', coalesce(jsonb_agg(x order by x.dias_restantes), '[]'::jsonb))
    from (
      select v.empresa, v.descricao, v.titular, v.cnpj, v.vencimento, v.arquivo, v.vencimento - (select d from hoje) as dias_restantes,
             c.razao_social as cliente, c.email, c.telefone, e.contato_nome, coalesce(e.contato_email, c.email) as email_contato, coalesce(e.whatsapp, c.telefone) as whatsapp
        from soc_vencimentos v
        left join gclik_clientes c on c.id = v.cliente_id
        left join ent_clientes e on e.cliente_id = v.cliente_id
       where v.tipo in ('certificado_a1', 'certificado_a3')
         and ((v.vencimento - (select d from hoje)) = any(marcos)
              or ((v.vencimento - (select d from hoje)) < 0 and ((select d from hoje) - v.vencimento) % 7 = 0 and (select d from hoje) - v.vencimento <= 60))
    ) x;
$$;

revoke all on function public.registrar_certificado(text, text, date, text, date) from public, anon, authenticated;
revoke all on function public.certificados_alerta(int[]) from public, anon, authenticated;
grant execute on function public.registrar_certificado(text, text, date, text, date) to service_role;
grant execute on function public.certificados_alerta(int[]) to service_role;
