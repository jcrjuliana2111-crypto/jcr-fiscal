-- Projeto qftusjwnlyjokilcjuzb. Notificações e obrigações: acesso só pela Edge Function
-- smart-handler (service role, que exige o login do portal ou a ROBO_KEY nas ações obr-*).
-- Política RESTRITIVA: soma-se à "acesso publico" existente e nega tudo a anon/authenticated.
-- Nenhum dado é apagado. Para desfazer: drop policy "somente_funcao" on <tabela>;
create policy "somente_funcao" on public.notificacoes_fiscais as restrictive for all to anon, authenticated using (false) with check (false);
create policy "somente_funcao" on public.obr_empresas as restrictive for all to anon, authenticated using (false) with check (false);
create policy "somente_funcao" on public.obr_entregas as restrictive for all to anon, authenticated using (false) with check (false);

-- PDFs das notificações: bucket privado; só a função (service role) lê e grava.
-- A página pede um link temporário (ação pdf-link). Nenhum arquivo é apagado.
update storage.buckets set public = false where id = 'notificacoes-pdf';
create policy "notificacoes_pdf_somente_funcao" on storage.objects as restrictive for all to anon, authenticated
  using (bucket_id <> 'notificacoes-pdf') with check (bucket_id <> 'notificacoes-pdf');
