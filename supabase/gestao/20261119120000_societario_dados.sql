-- Painel Societário: dados do contrato preenchidos no portal (sócios, capital, endereço/IPTU,
-- objeto, alterações, distrato, cláusulas adicionais) e município do processo (links por prefeitura).
-- Só acrescenta colunas; nada existente é alterado.
alter table public.soc_processos add column if not exists dados jsonb not null default '{}'::jsonb;
alter table public.soc_processos add column if not exists municipio text;
