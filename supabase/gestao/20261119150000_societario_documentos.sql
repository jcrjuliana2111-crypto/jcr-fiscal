-- Painel Societário: documentos enviados por processo (RG/CNH, comprovante de residência, IPTU,
-- contrato anterior, ficha da JUCESP, cartão CNPJ). Arquivos guardados na pasta privada "societario"
-- do Storage, no caminho <user_id>/<processo_id>/<arquivo>; cada usuário só acessa a própria pasta.
-- Só cria objetos novos; nada existente é alterado.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('societario', 'societario', false, 15728640, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy soc_arquivos_dono_select on storage.objects for select to authenticated
  using (bucket_id = 'societario' and (storage.foldername(name))[1] = auth.uid()::text);
create policy soc_arquivos_dono_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'societario' and (storage.foldername(name))[1] = auth.uid()::text);
create policy soc_arquivos_dono_delete on storage.objects for delete to authenticated
  using (bucket_id = 'societario' and (storage.foldername(name))[1] = auth.uid()::text);

create table if not exists public.soc_documentos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  processo_id  uuid not null references public.soc_processos(id) on delete cascade,
  tipo_doc     text not null,          -- pessoal | residencia | iptu | contrato | ficha | cnpj | outro
  socio        int,                    -- índice do sócio no formulário (documentos pessoais)
  nome_arquivo text not null,
  caminho      text not null,          -- caminho no bucket "societario"
  tamanho      int,
  mime         text,
  extraido     jsonb,                  -- o que foi lido do documento
  lido_por     text,                   -- local | ia
  created_at   timestamptz not null default now()
);
create index if not exists soc_documentos_processo on public.soc_documentos (processo_id);
alter table public.soc_documentos enable row level security;
create policy soc_documentos_dono on public.soc_documentos for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
