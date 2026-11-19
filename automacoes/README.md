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

## Certificados digitais — portal ⇄ VPS e avisos de vencimento

```
Portal (Importar em lote) ─► Edge Function certificados-vps ─► n8n "receber-certificado" ─► pasta do robô na VPS
Robô da VPS (salvou certificado) ─► passo "Avisar o portal" ─► Supabase registrar_certificado
Todo dia 8h15 ─► certificados_alerta (60/45/30/15/7/1/0 dias e vencidos) ─► Telegram (você) + e-mail (cliente)
```

### 1. `n8n/receber-certificado.json` — o portal grava o certificado na pasta do robô

1. Importe o fluxo. No nó **Recebe do portal**, crie a credencial **Header Auth**: nome `X-Chave-JCR` e,
   como valor, uma senha longa que você inventar (40+ letras e números).
2. No nó **Configuração**: `pasta` = a mesma pasta onde o robô de notas guarda os certificados (o caminho
   como o n8n enxerga, ex.: `/home/node/.n8n/certificados` no Docker), e `padrao_nome` = o padrão de nome
   que o robô usa quando a senha precisa ir no nome (só é usado se você digitar a senha no portal;
   ex.: `{nome} - senha {senha}.pfx`).
3. Ative o fluxo e copie a **Production URL** do webhook.
4. No Supabase do portal → Edge Functions → Secrets: `N8N_CERT_URL` = a URL e `N8N_CERT_CHAVE` = a mesma
   senha do Header Auth. Não mande essa senha por mensagem.
5. No portal, Certificados e alvarás → **Importar certificados em lote**: a coluna "Na VPS" mostra ✓.

O portal guarda só titular, CNPJ/CPF, validade e o nome do arquivo. O arquivo e a senha ficam só na VPS.

### 2. `n8n/passo-robo-registrar-certificado.json` — o robô avisa o portal

Abra o fluxo do robô que salva os certificados, cole este passo (copiar o conteúdo do arquivo e colar na tela
do fluxo) logo depois de gravar o arquivo, e ajuste os campos do corpo para os nomes que o robô usa:
`documento` (CNPJ/CPF), `titular`, `vencimento` (AAAA-MM-DD), `arquivo` e `emitido_em`. Use a credencial do
Supabase (service role). O certificado aparece no portal ligado ao cliente pelo CNPJ (se já existir, só atualiza a data).

### 3. `n8n/alerta-certificados.json` — avisos no Telegram e para o cliente

- Todo dia às 8h15, os certificados que completam hoje 60, 45, 30, 15, 7, 1 ou 0 dias para vencer
  (lista em `marcos` na Configuração) e os vencidos (lembrete semanal por até 60 dias).
- **Telegram**: crie a credencial do bot do Telegram no nó *Enviar no Telegram* e coloque o seu chat id em
  `telegram_chat_id`. A mensagem não leva o nome do arquivo (que contém a senha).
- **Cliente**: com `avisar_cliente = true`, manda e-mail pelo Gmail para o contato do cliente (JCR Entregas ou
  Gestão Fiscal). O nó *Avisos aos clientes* também entrega `whatsapp` e `mensagem`, para ligar um nó de
  WhatsApp (ex.: Evolution API) se você usar.
