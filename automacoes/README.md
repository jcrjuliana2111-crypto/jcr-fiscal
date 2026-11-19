# Automações (n8n)

Fluxos do n8n que trabalham com os dados do Portal JCR. Cada fluxo é um arquivo
`.json` para importar no n8n (menu **Workflows → Import from File**, ou colar o
conteúdo direto na tela do fluxo).

Nenhum arquivo daqui guarda senha ou chave: as credenciais ficam só dentro do n8n.

## Alerta diário de prazos — `n8n/alerta-prazos.json`

Todo dia útil às 7h (horário de Brasília) envia um e-mail com o que vence hoje,
o que vence nos próximos 7 dias e o que está atrasado: entregas pendentes do
**JCR Entregas** (fonte única das obrigações) e honorários a receber do Gestão Fiscal.

```
Todo dia útil às 7h → Configuração → Buscar prazos (Supabase) → Montar e-mail → Enviar e-mail (Gmail)
```

- Os dados vêm da função `alerta_prazos(dias)` do Supabase
  (`supabase/gestao/20261020090000_alerta_prazos_entregas.sql`). Ela é só de leitura e só
  pode ser chamada com a chave **service role**: a chave pública do site não tem acesso.
- O código do nó "Montar e-mail" fica também em `n8n/alerta-prazos.code.js`, para
  facilitar a leitura e a revisão.

### Como colocar para funcionar

1. **Importar** o arquivo `n8n/alerta-prazos.json` no n8n.
2. **Credencial do Supabase**: no nó *Buscar prazos (Supabase)*, crie uma credencial
   do tipo **Supabase API**:
   - Host: `https://onecnoicxqjhgolqncjj.supabase.co`
   - Service Role Secret: no Supabase, *Project Settings → API Keys* → chave
     **secret** (`sb_secret_…`) ou a antiga **service_role**.
   Essa chave dá acesso total ao banco. Ela fica só no n8n e nunca deve ir para
   o site, para o GitHub ou para mensagens.
3. **Credencial do Gmail**: no nó *Enviar e-mail (Gmail)*, conecte a conta que vai
   enviar o alerta (Gmail OAuth2).
4. **Configuração**: no nó *Configuração*, ajuste o destinatário, quantos dias à
   frente olhar (`dias`) e quantos atrasados listar no e-mail (`limite_atrasados`).
5. Clique em **Test workflow** para receber um e-mail agora. Se estiver tudo certo,
   **ative** o fluxo (botão *Active*).

### Para mudar o horário

No nó *Todo dia útil às 7h*, a regra é `0 7 * * 1-5` (minuto, hora, dia, mês,
dia da semana). Por exemplo, `30 8 * * 1-5` envia às 8h30. O fuso do fluxo já
está em `America/Sao_Paulo`.

## Societário — `n8n/alerta-societario.json` e `n8n/emails-jucesp.json`

- **Alerta societário** (todo dia útil às 7h10): exigências da Junta com o prazo de 30 dias, processos sem
  movimento há mais de 7 dias e certificados/alvarás/licenças que vencem nos próximos 30 dias
  (função `alerta_societario(dias)`). Só envia quando há algo, salvo `enviar_vazio = true` na Configuração.
- **E-mails da JUCESP e da REDESIM** (a cada 15 minutos): lê no Gmail os e-mails da Junta, do Facilita SP/VRE e
  da REDESIM, descobre o protocolo e o que aconteceu (exigência, indeferimento, deferimento, CNPJ emitido,
  análise de vício sem pendência) e atualiza o processo certo no Painel Societário
  (função `registrar_evento_societario`). Para funcionar, o protocolo precisa estar preenchido no processo.

## Comercial — `n8n/alerta-comercial.json`

Todo dia útil às 8h20: oportunidades paradas na entrada de clientes (com links prontos de WhatsApp e e-mail e a
mensagem certa para cada etapa), pesquisas de satisfação sem resposta e notas baixas (função `alerta_comercial()`).

### Como colocar para funcionar (os três)

1. Importar o `.json` no n8n.
2. Nos nós do Supabase, usar a mesma credencial **Supabase API** do alerta de prazos (chave service role).
3. Nos nós do Gmail, conectar a conta do escritório (no fluxo dos e-mails da Junta, a conta que recebe esses e-mails).
4. Na **Configuração**, trocar `coloque-aqui-o-seu-email@exemplo.com` pelo e-mail que deve receber o aviso.
5. **Test workflow** e depois **ativar**.

O código dos nós fica nos arquivos `*.code.js`. Depois de mudar um deles, rode
`python3 automacoes/n8n/gerar-fluxos.py` para atualizar os `.json` (os testes conferem se estão iguais).
