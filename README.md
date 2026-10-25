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
| `contas-pagar/` | Contas a pagar do dia (BPO Financeiro): contas em aberto do Conta Azul (mesma chave/cliente da Conciliação) ou importadas da planilha do escritório, marcação do que paga, saldos dos bancos (sobra/falta com e sem limite), alertas (protesto, vencida, duplicada, não lançada), planilha do dia (.xlsx), resumo para o cliente e lista para o Gerador de lista Pix. Dados ficam no navegador, por cliente e dia |
| `pix-lote/` | Gerador de lista Pix (BPO Financeiro): converte a planilha de pagamentos no layout da extensão "Pix em lote - Unicred (preencher)". Também confere a lista com o PDF do banco (Transações Pendentes ou Extrato): conferidos, faltando, valor diferente e fora da lista. Histórico fica só no navegador |
| `supabase/` | Edge Function `conta-azul` e migrações do robô de conciliação (projeto `qftusjwnlyjokilcjuzb`) |
| `automacoes/` | Fluxos do **n8n** (ex.: alerta diário de prazos por e-mail) — ver `automacoes/README.md` |
| `tests/` | Testes do motor de conciliação (`node --test tests/*.test.js`) |
| `hub/` | Ferramentas, conhecimento e documentos do antigo repositório `hub-jcr` |
| `assets/jcr-guard.js` | Proteção comum: sem login, manda para o portal; mostra o botão "Portal" |

As páginas de `hub/` ficaram juntas na mesma pasta de propósito: os links entre
elas continuam funcionando exatamente como antes.

## Departamentos, processos e procedimentos

A página inicial mostra os 12 departamentos: Societário, Fiscal, Contábil, Pessoal,
BPO Financeiro, Recuperação Tributária, Fiscalização, IRPF, Comercial, Financeiro do
escritório, Administrativo e Conhecimento. Cada um lista seus processos, as ferramentas
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
| Notificações | Supabase `qftusjwnlyjokilcjuzb` (Edge Function `smart-handler`) |
| Conciliação Conta Azul | Supabase `qftusjwnlyjokilcjuzb` (Edge Function `conta-azul`, tabelas `conta_azul_conexoes` e `conciliacao_log`) — protegida pela `ROBO_KEY` |
| Clientes, Conhecimento, Ferramentas extras, Pomodoro, Hub | Navegador (`localStorage`) do endereço `jcrjuliana2111-crypto.github.io` |

Os endereços e as chaves do Supabase não mudaram, então os dados continuam os mesmos.
Os dados guardados no navegador ficam ligados ao endereço `jcrjuliana2111-crypto.github.io`,
que é o mesmo para todos os repositórios do GitHub Pages desta conta. Por isso eles
continuam aparecendo no novo site. **Se um dia o site for para outro domínio
(Vercel, Netlify, domínio próprio), exporte esses dados antes.**

## Login

O portal usa o mesmo login do Gestão Fiscal. Entrando uma vez, todas as páginas
ficam liberadas. Para dar acesso a alguém, crie o usuário no Supabase
(Authentication → Users → Add user) no projeto `onecnoicxqjhgolqncjj`.

## Limites atuais e próximos passos

- **O código continua público enquanto o repositório for público.** A proteção
  do portal é de navegação. A proteção real dos dados vem do Supabase:
  - [ ] Conferir se as tabelas `gclik_*` têm RLS ativado (só usuário logado lê e grava).
  - [ ] Fazer a Edge Function `smart-handler` (Notificações) exigir login. Hoje ela
        aceita chamadas de qualquer pessoa.
- [ ] Recursos de IA (Analisador XML, Conhecimento, Radar e IA do Gestão Fiscal) chamam
      `api.anthropic.com` direto do navegador e não funcionam fora do claude.ai.
      O certo é passar por uma Edge Function com a chave guardada no servidor.
- [ ] Acesso por pessoa (quem vê o quê), se necessário.
