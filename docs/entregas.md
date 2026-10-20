# JCR Entregas

Controle de obrigações e entregas do escritório, no estilo do Acessórias.
Endereço: `https://jcrjuliana2111-crypto.github.io/jcr-fiscal/entregas/`

## Telas

| Tela | Para que serve |
|---|---|
| **Painel** | Competência escolhida: total, concluídas, pontualidade (% entregue no prazo), metas internas vencidas, vencendo hoje e atrasadas. Quadro por departamento e por responsável. |
| **Entregas** | Lista com filtros (competência, situação, departamento, responsável, cliente, busca). Concluir com data, valor da guia, arquivos e observação; ações em lote; exportar CSV. |
| **Agenda** | Calendário com os vencimentos do mês e os feriados. |
| **Clientes** | Vêm do Gestão Fiscal (`gclik_clientes`). Aqui ficam responsáveis por departamento, contato, link do portal e quais obrigações cada cliente tem. |
| **Obrigações** | Catálogo com prazo legal, regra de dia útil, meta interna e regimes. Há um catálogo padrão para começar e o botão "Aplicar aos clientes". |
| **Regimes** | Cadastro dos regimes tributários (tabela `ent_regimes`). Em cada regime, "Obrigações do regime" marca quais obrigações valem para ele e pode já marcá-las nos clientes ativos do regime. Renomear atualiza clientes e obrigações. A mesma lista aparece no cadastro de clientes do Gestão Fiscal. |
| **Processos** | Abertura, alteração, baixa, admissão, rescisão e entrada de cliente, com checklist e prazo de cada passo. Modelos editáveis. |
| **Protocolos** | Documentos publicados no portal e a confirmação de leitura do cliente. |
| **Configurações** | Feriados estaduais e municipais (os nacionais são automáticos). |

## Rotina do mês

1. **Entregas → Gerar entregas** com a competência (por padrão, o mês anterior).
   Só gera o que vence naquela competência (mensal, trimestral, anual…) e nunca duplica.
2. Cada responsável filtra as suas e conclui: anexa a guia/recibo e deixa marcado
   "Publicar no portal do cliente". Ao salvar, abre o aviso por WhatsApp ou e-mail com o link e o protocolo.
3. Em **Protocolos**, acompanhe quem ainda não abriu.

## Regras de prazo (`entregas/entregas-core.js`)

- **Dia**: dia do mês, ou n-ésimo dia útil, ou 0 = último dia útil.
- **Dia não útil**: antecipa, prorroga ou mantém. Contam como não úteis: sábado, domingo, feriados nacionais,
  Carnaval, Sexta-feira Santa, Corpus Christi e os feriados cadastrados em Configurações.
- **Competência**: vence N meses depois (padrão 1). Anual vence no mês escolhido do ano seguinte ao ano-base
  (a entrega anual é gerada na competência 12).
- **Meta interna**: N dias úteis antes do vencimento. Situações: pendente → meta interna vencida → vence hoje → atrasada;
  entregue no prazo / com atraso (comparando a data da entrega com o vencimento); dispensada.
- Mudar uma obrigação não altera entregas já geradas.

Os prazos do catálogo padrão de ICMS, SPED Fiscal e ISS variam por estado e município: ajuste antes de gerar.

Testes: `node --test tests/*.test.js`.

## Banco e portal

- SQL: `supabase/gestao/20261017120000_entregas.sql` e `20261020120000_regimes.sql` (já aplicado no projeto `onecnoicxqjhgolqncjj`).
  Tabelas `ent_*` com RLS por `user_id`, como as `gclik_*`.
- Arquivos: bucket privado `entregas`, pasta `<user_id>/<entrega_id>/`.
- Portal do cliente: `entregas/portal.html?t=<token>`, sem login. Os dados vêm da Edge Function
  `entregas-portal` (`supabase/functions/entregas-portal/`, publicada com `verify_jwt = false` porque
  quem autentica é o token do cliente). Ela só mostra o que foi publicado, gera links de download
  válidos por 1 hora e registra a leitura. "Gerar novo link" na ficha do cliente invalida o anterior.
