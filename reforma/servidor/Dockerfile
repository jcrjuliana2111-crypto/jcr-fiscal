# Calculadora oficial da Reforma Tributária (Receita Federal / Serpro, licença MIT)
# rodando sem alteração, atrás de um porteiro (Caddy) que só deixa passar quem tem a chave.
#
# Para atualizar a versão da Receita, troque RTC_REF pelo commit novo do repositório
# github.com/ReceitaFederal/calculadora-rtc-regime-regular (a rotina mensal faz isso sozinha).

FROM maven:3.9-eclipse-temurin-21 AS build
ARG RTC_REF=150cccbe414d4a5edea703e4f7a424af5aa222c7
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*
WORKDIR /src
RUN git init -q . && git remote add origin https://github.com/ReceitaFederal/calculadora-rtc-regime-regular.git \
 && git fetch -q --depth 1 origin "$RTC_REF" && git checkout -q FETCH_HEAD
# Banco SQLite com as tabelas oficiais (mesmo comando do README da Receita) e o pacote da API
RUN mkdir -p calculadora/db \
 && mvn -q -B flyway:migrate -Dflyway.configFiles=./flyway/flyway-pro.conf \
 && mvn -q -B -DskipTests package

FROM caddy:2.8.4 AS caddy

FROM eclipse-temurin:21-jre
COPY --from=caddy /usr/bin/caddy /usr/bin/caddy
WORKDIR /app
COPY --from=build /src/target/api-regime-geral.jar /app/api.jar
COPY --from=build /src/calculadora/db /app/calculadora/db
COPY Caddyfile /app/Caddyfile
COPY iniciar.sh /app/iniciar.sh
RUN chmod +x /app/iniciar.sh
ENV PORT=10000
EXPOSE 10000
CMD ["/app/iniciar.sh"]
