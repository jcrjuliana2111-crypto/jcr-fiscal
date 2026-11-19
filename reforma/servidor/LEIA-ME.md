# Calculadora oficial da Reforma Tributária (servidor)

Roda o programa da Receita Federal/Serpro (`calculadora-rtc-regime-regular`, licença MIT) **sem alteração**,
num contêiner com um porteiro (Caddy) que só aceita chamadas com o cabeçalho `X-Chave-RTC`.

```
portal (login) ──► Edge Function calculadora-rtc (Supabase) ──► Render: Caddy ──► API da Receita (Java)
                     confere o login e põe a chave                 confere a chave
```

## Ligar (uma vez)

1. render.com → entrar com o GitHub → **New → Blueprint** → repositório `jcr-fiscal`.
   O `render.yaml` cria o serviço `jcr-calculadora-rtc` (plano free) e gera `RTC_CHAVE`.
2. Quando estiver *Live*: copiar o endereço do serviço e o valor de `RTC_CHAVE` (Environment).
3. Supabase do portal → Edge Functions → Secrets: `RTC_URL` (endereço) e `RTC_CHAVE` (chave).
4. Portal → Reforma Tributária → Servidor oficial → "Tentar de novo".

Plano free: dorme após 15 min sem uso (primeira chamada leva até ~1 min). Starter (~US$ 7/mês) fica sempre ligado.

## Atualizar a versão da Receita

`ARG RTC_REF` no `Dockerfile` aponta o commit da Receita. A rotina `.github/workflows/reforma-tabelas.yml`
confere todo mês, troca o commit, regera `reforma/dados` e abre um pull request. Aprovou → o Render refaz o servidor.

## Testar localmente

```
docker build -t rtc reforma/servidor
docker run -p 10000:10000 -e RTC_CHAVE=uma-chave-com-24-caracteres-ou-mais rtc
curl localhost:10000/saude
```
