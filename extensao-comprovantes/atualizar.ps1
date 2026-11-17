# Baixa a versão mais nova da extensão do Portal JCR para Documents\Extensoes\extensao-comprovantes.
# Roda pela tarefa agendada "JCR - atualizar extensao" (criada pelo instalar.bat).
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$base = 'https://jcrjuliana2111-crypto.github.io/jcr-fiscal/extensao-comprovantes/'
$dest = Join-Path $env:USERPROFILE 'Documents\Extensoes\extensao-comprovantes'
$tmp = Join-Path $env:TEMP 'jcr-extensao'
New-Item -ItemType Directory -Force -Path $dest, $tmp | Out-Null
$t = [DateTime]::Now.Ticks
$lista = (Invoke-WebRequest -UseBasicParsing -Uri "${base}arquivos.txt?t=$t").Content -split "`r?`n" | Where-Object { $_ -match '\S' }
# baixa tudo primeiro; só troca a pasta se nada falhou (o manifest por último, é ele que dispara a recarga)
foreach ($a in $lista) { Invoke-WebRequest -UseBasicParsing -Uri "${base}${a}?t=$t" -OutFile (Join-Path $tmp $a) }
foreach ($a in @($lista | Where-Object { $_ -ne 'manifest.json' }) + @('manifest.json')) {
  Copy-Item (Join-Path $tmp $a) (Join-Path $dest $a) -Force
}
