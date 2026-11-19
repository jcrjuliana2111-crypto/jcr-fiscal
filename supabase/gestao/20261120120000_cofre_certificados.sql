-- Cofre de certificados digitais: o .pfx é criptografado NO NAVEGADOR (AES-256-GCM, chave derivada da
-- senha do cofre com PBKDF2-SHA256, 600 mil iterações) antes de subir. O Supabase guarda só o arquivo
-- ilegível; a senha do cofre não é guardada em lugar nenhum. Só acrescenta; não altera dados existentes.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cofre-certificados', 'cofre-certificados', false, 1048576, array['application/octet-stream'])
on conflict (id) do nothing;

-- Cada usuário só lê e grava na própria pasta (<user_id>/...)
create policy cofre_cert_ler on storage.objects for select to authenticated
  using (bucket_id = 'cofre-certificados' and (storage.foldername(name))[1] = auth.uid()::text);
create policy cofre_cert_gravar on storage.objects for insert to authenticated
  with check (bucket_id = 'cofre-certificados' and (storage.foldername(name))[1] = auth.uid()::text);
create policy cofre_cert_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'cofre-certificados' and (storage.foldername(name))[1] = auth.uid()::text);

-- Verificador da senha do cofre: um texto conhecido criptografado com a senha. Serve só para avisar
-- "senha errada" antes de guardar um certificado com uma senha diferente. Não permite descobrir a senha.
create table if not exists public.soc_cofre (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  verificador text not null,
  criado_em timestamptz not null default now()
);
alter table public.soc_cofre enable row level security;
create policy soc_cofre_dono on public.soc_cofre for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.soc_vencimentos add column if not exists cofre_caminho text;
alter table public.soc_vencimentos add column if not exists cofre_em timestamptz;

-- Registro de quem guardou e baixou cada certificado (não dá para apagar nem alterar pelo portal)
create table if not exists public.soc_cofre_log (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vencimento_id uuid,
  documento text,
  acao text not null check (acao in ('guardou', 'baixou')),
  em timestamptz not null default now()
);
alter table public.soc_cofre_log enable row level security;
create policy soc_cofre_log_ler on public.soc_cofre_log for select to authenticated using (auth.uid() = user_id);
create policy soc_cofre_log_gravar on public.soc_cofre_log for insert to authenticated with check (auth.uid() = user_id);
