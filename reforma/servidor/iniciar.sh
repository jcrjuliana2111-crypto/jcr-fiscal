#!/bin/sh
set -e
if [ -z "$RTC_CHAVE" ] || [ ${#RTC_CHAVE} -lt 24 ]; then
  echo "Defina RTC_CHAVE (24+ caracteres) nas variáveis do serviço." >&2
  exit 1
fi
# API da Receita só na rede interna do contêiner; o Caddy atende a porta pública
java -Xmx200m -Xss512k -XX:MaxMetaspaceSize=128m -XX:ReservedCodeCacheSize=48m -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -Dserver.tomcat.threads.max=16 -Dspring.profiles.active=offline -Dserver.port=8080 -Dserver.address=127.0.0.1 \
  -Dmanagement.server.address=127.0.0.1 -jar /app/api.jar &
exec caddy run --config /app/Caddyfile --adapter caddyfile
