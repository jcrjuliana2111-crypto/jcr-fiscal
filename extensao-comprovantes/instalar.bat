@echo off
chcp 65001 >nul
echo.
echo  JCR - Comprovantes no Conta Azul
echo  Instalando em %USERPROFILE%\Documents\Extensoes\extensao-comprovantes ...
echo.
set "PASTA=%USERPROFILE%\Documents\Extensoes\extensao-comprovantes"
if not exist "%PASTA%" mkdir "%PASTA%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol='Tls12'; Invoke-WebRequest -UseBasicParsing 'https://jcrjuliana2111-crypto.github.io/jcr-fiscal/extensao-comprovantes/atualizar.ps1' -OutFile '%PASTA%\atualizar.ps1'"
powershell -NoProfile -ExecutionPolicy Bypass -File "%PASTA%\atualizar.ps1"
if errorlevel 1 (
  echo  Nao consegui baixar a extensao. Confira a internet e rode de novo.
  pause
  exit /b 1
)
schtasks /Create /F /TN "JCR - atualizar extensao" /SC HOURLY /TR "powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \"%PASTA%\atualizar.ps1\"" >nul
echo  Pronto! A pasta foi criada e vai se atualizar sozinha a cada hora.
echo.
echo  Falta so uma vez no Chrome:
echo   1. Abra chrome://extensions e ligue o "Modo do desenvolvedor"
echo   2. Clique em "Carregar sem compactacao" e escolha a pasta que vai abrir agora
echo.
start "" "%PASTA%"
pause
