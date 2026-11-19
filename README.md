# Portal JCR

Site único do escritório, com login, reunindo todas as ferramentas.

## Estrutura

| Caminho | O que é |
|---|---|
| `index.html` | **Portal**: login (Supabase Auth) e departamentos do escritório |
| `procedimento.html` | Página de procedimento (POP) de cada processo |
| `assets/departamentos.js` | **Catálogo**: departamentos, processos e ferramentas (ativas e ideias) |
| `assets/procedimentos.js` | **Procedimentos** escritos, por `departamento/processo` |
| `entregas/` | **JCR Entregas** (estilo Acessórias): obrigações por cliente e departamento, geração da competência, prazos em dia útil, metas internas, processos, protocolos e portal do cliente — ver `docs/entregas.md` |
| `gclik.html` | Gestão Fiscal: clientes, tarefas, obrigações, agenda, honorários, IRPF, fechamento |
| `notificacoes/` | Controle de Notificações Fiscais (antigo repositório `controle-fiscal`) |
| `conciliacao/` | Robô de conciliação bancária com o Conta Azul (BPO Financeiro) — ver `docs/conciliacao-conta-azul.md` |
| `relatorios/` | Relatórios financeiros (BPO): DRE (competência ou caixa), fluxo de caixa (realizado e previsto) e balanço gerencial a partir das contas a pagar/receber do Conta Azul, com comparação entre períodos, gráficos (Chart.js), mapa categoria → linha da DRE (por cliente, no navegador) e exportação Excel/PDF |
| `contas-pagar/` | Contas a pagar do dia (BPO Financeiro): contas em aberto do Conta Azul (mesma chave/cliente da Conciliação) ou importadas da planilha do escritório, marcação do que paga, saldos dos bancos (sobra/falta com e sem limite), alertas (protesto, vencida, duplicada, não lançada), planilha do dia (.xlsx), resumo para o cliente e lista para o Gerador de lista Pix. Dados ficam no navegador, por cliente e dia |
| `financeiro/` | **Financeiro JCR** (só o escritório, sem Conta Azul): contas a pagar com repetição mensal e baixa em lote, receitas avulsas, categorias ligadas à DRE, contas bancárias, fluxo de caixa (realizado e previsto) e DRE por competência ou caixa. Receitas de honorários vêm do Gestão Fiscal (escritório JCR). **Importar extrato** (OFX/CSV, ex.: Cora): cada movimento vira honorário recebido (existente ou novo), despesa paga, receita, transferência (só caixa) ou é ignorado; não importa duas vezes e aprende a categoria pelo texto |
| `societario/` | **Painel Societário**: processos de abertura, alteração, transformação, encerramento (distrato) e baixa nos órgãos, com as etapas dos manuais do Facilita SP e do DREI, exigências com prazo de 30 dias, responsável (escritório ou freelance) e lista de documentos para mandar ao cliente. **Conferidor de documentos** (`societario/conferidor.html`): lê no navegador os PDFs gerados para a JUCESP, identifica o processo (abertura, alteração, transformação, encerramento, enquadramento; LTDA ou empresário individual) e aponta divergências e elementos obrigatórios faltando antes de assinar; regras em `societario/conferidor-core.js`, uma por exigência já recebida. **Dados e documentos** (`societario/modelos.html`): formulário por processo (sócios, capital, endereço/IPTU, objeto, alterações, distrato e cláusulas adicionais) que gera o Word do contrato social, da alteração contratual (com consolidação), da transformação de empresário individual e do distrato, com o texto das cláusulas fixo; os dados ficam no processo (`soc_processos.dados`). **Documentos do processo**: envio de RG/CNH, comprovante de residência, carnê do IPTU, contrato anterior, ficha da JUCESP e cartão CNPJ, guardados na pasta privada `societario` do Storage (tabela `soc_documentos`); o portal lê o documento (formulários da JUCESP no navegador, `societario/leitor-core.js`; os demais pela Edge Function `ler-documento-societario`, que usa a chave `ANTHROPIC_API_KEY` dos secrets do Supabase — código em `supabase/gestao/functions/`) e sugere o preenchimento campo a campo para conferir antes de aplicar. **Links oficiais** por etapa e por prefeitura (online e presencial) em `societario/links.js`, usados no painel e nos procedimentos. Procedimentos de cada ato em `assets/procedimentos.js`, com links para os manuais no Drive |
| `pix-lote/` | Gerador de lista Pix (BPO Financeiro): converte a planilha de pagamentos no layout da extensão "Pix em lote - Unicred (preencher)". Também confere a lista com o PDF do banco (Transações Pendentes ou Extrato): conferidos, faltando, valor diferente e fora da lista. Histórico fica só no navegador |
| `supabase/` | Edge Function `conta-azul` e migrações do robô de conciliação (projeto `qftusjwnlyjokilcjuzb`) |
| `automacoes/` | Fluxos do **n8n** (ex.: alerta diário de prazos por e-mail) — ver `automacoes/README.md` |
| `tests/` | Testes do motor de conciliação (`node --test tests/*.test.js`) |
| `hub/` | Ferramentas, conhecimento e documentos do antigo repositório `hub-jcr` |
| `assets/jcr-guard.js` | Proteção comum: sem login, manda para o portal; mostra o botão "Portal" |

As páginas de `hub/` ficaram juntas na mesma pasta de propósito: os links entre
elas continuam funcionando exatamente como antes.

## Departamentos, processos e procedimentos

A página inicial mostra os 13 departamentos: Societário, Fiscal, Reforma Tributária,
Contábil, Pessoal, BPO Financeiro, Recuperação Tributária, Fiscalização, IRPF, Comercial,
Financeiro do escritório, Administrativo e Conhecimento. Cada um lista seus processos, as ferramentas
que já existem e as automações a criar.

- **Novo processo ou ferramenta:** editar `assets/departamentos.js`.
- **Escrever um procedimento:** adicionar em `assets/procedimentos.js` com a chave
  `departamento/processo`. O processo passa de "A documentar" para "Procedimento".
- **Ferramenta nova pronta:** colocar o arquivo HTML no site e trocar o item de
  `status: 'ideia'` para `status: 'ativa'`, informando a `url`.

## Onde ficam os dados (nada foi movido)

| Ferramenta | Onde os dados ficam |
|---|---|
| Gestão Fiscal | Supabase `onecnoicxqjhgolqncjj` (tabelas `gclik_*`, `irpf_clientes`) |
| JCR Entregas | Supabase `onecnoicxqjhgolqncjj` (tabelas `ent_*`, bucket `entregas`, Edge Function `entregas-portal`) — SQL em `supabase/gestao/` |
| Financeiro JCR | Supabase `onecnoicxqjhgolqncjj` (tabelas `fin_categorias`, `fin_contas_bancarias`, `fin_lancamentos`, `fin_extrato_movs`, `fin_regras`) — SQL em `supabase/gestao/2026102*_financeiro_*.sql` |
| Painel Societário | Supabase `onecnoicxqjhgolqncjj` (tabela `soc_processos`) — SQL em `supabase/gestao/20261112120000_societario.sql` |
| Notificações | Supabase `qftusjwnlyjokilcjuzb` (Edge Function `smart-handler`) |
| Conciliação Conta Azul | Supabase `qftusjwnlyjokilcjuzb` (Edge Function `conta-azul`, tabelas `conta_azul_conexoes` e `conciliacao_log`) — protegida pela `ROBO_KEY` |
| Clientes, Conhecimento, Ferramentas extras, Pomodoro, Hub | Navegador (`localStorage`) do endereço `jcrjuliana2111-crypto.github.io` |

Os endereços e as chaves do Supabase não mudaram, então os dados continuam os mesmos.
Os dados guardados no navegador ficam ligados ao endereço `jcrjuliana2111-crypto.github.io`,
que é o mesmo para todos os repositórios do GitHub Pages desta conta. Por isso eles
continuam aparecendo no novo site. **Se um dia o site for para outro domínio
(Vercel, Netlify, domínio próprio), exporte esses dados antes.**

## Reforma Tributária

`reforma/` tem o simulador de IBS/CBS por cliente (2026–2033, salvo na tabela `rt_simulacoes`)
e a consulta das tabelas oficiais da Receita (cClassTrib, CST, NCM, NBS, anexos, LC 116).
As tabelas ficam em `reforma/dados/` e saem do repositório aberto da Receita
(github.com/ReceitaFederal/calculadora-rtc-regime-regular, licença MIT):

    git clone --depth 1 https://github.com/ReceitaFederal/calculadora-rtc-regime-regular /tmp/rtc
    python3 reforma/scripts/gerar_dados.py /tmp/rtc

A aba "Calculadora oficial" usa o próprio programa da Receita, sem alteração, num servidor no
Render (`reforma/servidor`, `render.yaml`), acessado pela Edge Function `calculadora-rtc` (exige
login; secrets `RTC_URL` e `RTC_CHAVE`). "Classificar XMLs" lê NF-e/NFC-e/NFS-e no navegador e
salva a classificação em `rt_classificacoes`. A rotina `.github/workflows/reforma-tabelas.yml`
confere todo mês a versão da Receita e abre um pull request com tabelas e servidor atualizados.
Como ligar o servidor: `reforma/servidor/LEIA-ME.md`.

## Licenças por atividade

`societario/licencas.js` lista os registros exigidos pela atividade (CRC, CORE, OAB, CREA,
CRM, Vigilância Sanitária, CRECI, ANTT, CETESB…). Aparece no procedimento e como alerta no
"Dados e documentos" pelo objeto preenchido. Para incluir uma atividade, acrescente uma regra.

## Login

O portal usa o mesmo login do Gestão Fiscal. Entrando uma vez, todas as páginas
ficam liberadas. Para dar acesso a alguém, crie o usuário no Supabase
(Authentication → Users → Add user) no projeto `onecnoicxqjhgolqncjj`.

## Limites atuais e próximos passos

- **O código continua público enquanto o repositório for público.** A proteção
  do portal é de navegação. A proteção real dos dados vem do Supabase:
  - [x] Todas as tabelas do projeto `onecnoicxqjhgolqncjj` com RLS: só usuário logado
        (`clientes` e `clientes_pj` fechadas em 19/11/2026, cópia em `backup.*`).
  - [x] Edge Function `smart-handler` (Notificações) exige o login do portal; as ações
        `obr-*` aceitam também a `ROBO_KEY` (cabeçalho `x-robo-key`). Código em
        `supabase/functions/smart-handler/`. Tabelas `notificacoes_fiscais` e `obr_*`
        fechadas para acesso direto.
  - [x] `extrair-cnpj` e `ler-documento-societario` exigem login.
  - [x] Bucket `notificacoes-pdf` privado: o PDF abre por link temporário (1 hora) pedido pela página.
  - [x] Tabelas `rafael_*` (app de teste fora do portal) excluídas em 19/11/2026.
  - [ ] Tabela `clientes` tem coluna `senha` em texto puro: apagar se não for usada.
- [ ] Recursos de IA (Analisador XML, Conhecimento, Radar e IA do Gestão Fiscal) chamam
      `api.anthropic.com` direto do navegador e não funcionam fora do claude.ai.
      O certo é passar por uma Edge Function com a chave guardada no servidor.
- [ ] Acesso por pessoa (quem vê o quê), se necessário.
