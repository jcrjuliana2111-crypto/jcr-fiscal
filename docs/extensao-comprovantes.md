# Extensão “JCR · Comprovantes no Conta Azul”

A API do Conta Azul não deixa enviar anexos. A extensão faz isso **na tela do
Conta Azul, no seu navegador**: ela recebe do robô de conciliação os
comprovantes das baixas e coloca o arquivo no campo de anexo do lançamento.
Nada passa por IA nem por servidor — os arquivos ficam guardados no próprio
navegador.

## Instalação automática (recomendada)

1. Baixe o **instalar.bat** (link no robô ou
   https://jcrjuliana2111-crypto.github.io/jcr-fiscal/extensao-comprovantes/instalar.bat)
   e dê dois cliques. Se o Windows avisar "protegeu o computador", clique em
   **Mais informações → Executar assim mesmo**.
2. Ele cria `Documents\Extensoes\extensao-comprovantes` já extraída e agenda a
   tarefa **JCR - atualizar extensao**, que baixa a versão nova a cada hora.
3. Só uma vez: `chrome://extensions` → **Modo do desenvolvedor** →
   **Carregar sem compactação** → escolha essa pasta.

Daí em diante a extensão se atualiza sozinha: a tarefa troca os arquivos e a
extensão percebe a versão nova e se recarrega (em até 5 minutos). Aperte F5 nas
abas do robô e do Conta Azul que estavam abertas.

## Instalar (uma vez, Chrome ou Edge)

1. Baixe o arquivo `extensao-comprovantes.zip` e **extraia** numa pasta fixa
   (ex.: `Documentos\JCR\extensao-comprovantes`). Não apague essa pasta depois.
2. Abra `chrome://extensions` (no Edge: `edge://extensions`).
3. Ligue o **Modo do desenvolvedor** (canto superior direito; no Edge, à esquerda).
4. Clique em **Carregar sem compactação** e escolha a pasta extraída (a que tem
   o arquivo `manifest.json`).
5. Recarregue o robô de conciliação (Ctrl+F5) e o Conta Azul.

Para atualizar: substitua os arquivos da pasta e clique em ↻ na extensão em
`chrome://extensions`.

## Usar

1. No robô de conciliação, rode a conciliação e **dê baixa** como sempre.
2. Clique em **📎 Mandar comprovantes para a extensão** (vão só as baixas feitas
   que têm comprovante ligado).
3. No Conta Azul, aparece o botão **📎 Comprovantes (N)** no canto inferior
   direito. Clique para abrir a lista.
4. Abra o lançamento no Conta Azul e a janela **Inserir anexos**. O comprovante
   daquele lançamento aparece destacado (“provável deste lançamento”, pelo
   valor na tela).
5. Clique em **Anexar aqui**: o arquivo vai para a primeira linha vazia da
   janela (se não houver, a extensão clica em **Adicionar anexo**) e a
   **Descrição** é preenchida com “Comprovante de pagamento - nome”. Escolha o
   **Tipo de anexo**, **confira e clique em Salvar no Conta Azul**. Depois
   clique em **Já anexei** para tirar da lista.
6. Se o campo não for encontrado, use **Baixar arquivo** e anexe à mão.

## Pasta de comprovantes (sem o robô)

1. No painel **📎 Comprovantes** do Conta Azul, clique em **Escolher / ler pasta**.
2. Na página que abre, clique em **Escolher pasta** e aponte a pasta onde você
   salva os comprovantes (subpastas valem). Escolha o período (padrão: arquivos
   dos últimos 120 dias).
3. A extensão lê o **nome do arquivo e o texto do PDF** (sem IA) e mostra o que
   leu. Volte ao Conta Azul e aperte F5: o botão mostra **📂 N**.
4. O 📎 aparece nos lançamentos em que o **valor** bate e o **nome** também:
   2 palavras em comum (uma delas não genérica), ou 1 palavra marcante com a
   data batendo. Se o comprovante tem vencimento (`V ddmmaa`) ou data de
   pagamento, ela precisa estar perto das datas da linha.
5. Comprovante novo na pasta: abra a página de novo e clique em **Ler de novo**
   (se o Chrome perguntar, escolha **Permitir em todas as visitas** e ele passa a
   ler sozinho ao abrir).

Os comprovantes anexados (depois do **Salvar**) não aparecem mais.

## Arrastar o 📎 direto do lançamento

- Nas telas do Conta Azul (contas a pagar, conciliação…), aparece um **📎** ao
  lado do valor dos lançamentos que têm comprovante pendente — só quando o
  **valor e o nome** do favorecido aparecem na linha.
- **Arraste o 📎 até o campo "Escolha um arquivo / Ou arraste-o para este
  espaço"**: o arquivo entra naquela linha e a descrição é preenchida.
- Quando a janela **Inserir anexos** abre e cobre a lista, o comprovante do
  lançamento em que você clicou aparece num botão azul ao lado do título:
  arraste-o para o campo ou clique nele.
- Ao clicar em **Salvar** na janela, os comprovantes colocados saem da lista
  sozinhos.

## Limites desta primeira versão

- Ela usa a janela **Inserir anexos**; em outras telas, procura o campo de
  arquivo aberto (de preferência dentro da janela/modal). O **Tipo de anexo** e
  o **Salvar** ficam com você. Se o Conta Azul usar um componente diferente, me
  mande prints da tela de anexo para ajustar.
- A lista fica guardada no navegador onde a extensão foi instalada.
