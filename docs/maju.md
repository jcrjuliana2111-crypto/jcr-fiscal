# Maju ligada ao Portal JCR

A Maju é a assistente da Ju no n8n (Telegram). Ela também conversa dentro do Portal (`maju/`).

## Como ela lê e grava no Portal

Duas funções no Supabase `onecnoicxqjhgolqncjj` (`supabase/gestao/20261124090000_maju_portal.sql`),
liberadas só para a chave **service role**, que fica apenas na credencial
"Supabase — Portal JCR (Maju)" do n8n. A chave pública do site não consegue chamá-las.

| Função | O que faz |
|---|---|
| `maju_consultar(modulo, filtros)` | Leitura: `resumo`, `entregas`, `financeiro`, `honorarios`, `societario`, `vencimentos`, `tarefas`, `comercial`, `clientes`. Filtros: `cliente`, `status`, `de`, `ate`, `responsavel`, `busca`, `tipo`, `limite` |
| `maju_registrar(acao, dados)` | Ações: `baixar_entrega`, `pagar_lancamento`, `receber_honorario`, `criar_tarefa`, `concluir_tarefa`, `anotar_societario`. Tudo o que grava fica marcado como feito pela Maju |

No n8n:

- **Maju — Ferramenta: consultar Portal JCR** e **Maju — Ferramenta: registrar no Portal JCR** chamam essas funções.
- A ferramenta de registro só grava com `confirmado = sim`. Sem isso devolve uma prévia, e a Maju precisa do "sim" da Ju na conversa.

## Chat no Portal

`maju/index.html` envia `{ token, mensagem }` (como `text/plain`, sem pré-verificação de CORS) para
`https://n8n.jcrconsultoriatributaria.com.br/webhook/maju-portal` (workflow **Maju — Chat do Portal JCR**).

1. O n8n confere o token em `/auth/v1/user` do Supabase. Sem login válido, responde 401.
2. Lê as instruções atuais da Maju do workflow **Maju — Coordenadora** (mesma personalidade e regras do Telegram).
3. Responde com as mesmas ferramentas: prazos do Acessórias, Portal, equipe de especialistas (com pesquisa em fonte oficial e Agenda Tributária da Receita) e TickTick.

A conversa do chat fica na memória da Maju por usuário (`portal_<id do usuário>`), separada da conversa do Telegram.
