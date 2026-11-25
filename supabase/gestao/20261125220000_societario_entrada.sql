-- Forma de entrada do processo na Junta: digital (assinatura eletrônica) ou papel (protocolo presencial e retirada)
alter table public.soc_processos add column if not exists entrada text not null default 'digital';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'soc_processos_entrada_chk') then
    alter table public.soc_processos add constraint soc_processos_entrada_chk check (entrada in ('digital','papel'));
  end if;
end $$;
comment on column public.soc_processos.entrada is 'Forma de entrada na Junta: digital (assinatura eletrônica) ou papel (protocolo presencial e retirada)';
