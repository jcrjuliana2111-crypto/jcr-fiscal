-- Data em que o honorário foi recebido, gravada pelo Financeiro JCR ao clicar em "Receber".
-- Vazia (honorário marcado como Pago direto no Gestão Fiscal) = o fluxo de caixa usa o vencimento.
-- Já aplicada no projeto onecnoicxqjhgolqncjj.
alter table public.gclik_honorarios add column if not exists data_pagamento date;
comment on column public.gclik_honorarios.data_pagamento is 'Data em que o honorário foi recebido (preenchida pelo Financeiro JCR). Vazia = usa o vencimento.';
