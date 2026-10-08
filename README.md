# Portal JCR

Site único do escritório, com login, reunindo todas as ferramentas.

## Estrutura

| Caminho | O que é |
|---|---|
| `index.html` | **Portal**: login (Supabase Auth) e catálogo de todas as ferramentas |
| `gclik.html` | Gestão Fiscal: clientes, tarefas, obrigações, agenda, honorários, IRPF, fechamento |
| `notificacoes/` | Controle de Notificações Fiscais (antigo repositório `controle-fiscal`) |
| `hub/` | Ferramentas, conhecimento e documentos do antigo repositório `hub-jcr` |
| `assets/jcr-guard.js` | Proteção comum: sem login, manda para o portal; mostra o botão "Portal" |

As páginas de `hub/` ficaram juntas na mesma pasta de propósito: os links entre
elas continuam funcionando exatamente como antes.

## Onde ficam os dados (nada foi movido)

| Ferramenta | Onde os dados ficam |
|---|---|
| Gestão Fiscal | Supabase `onecnoicxqjhgolqncjj` (tabelas `gclik_*`, `irpf_clientes`) |
| Notificações | Supabase `qftusjwnlyjokilcjuzb` (Edge Function `smart-handler`) |
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
