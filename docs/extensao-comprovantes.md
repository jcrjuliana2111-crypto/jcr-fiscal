# Extensão “JCR · Comprovantes no Conta Azul”

A API do Conta Azul não deixa enviar anexos. A extensão faz isso **na tela do
Conta Azul, no seu navegador**: ela recebe do robô de conciliação os
comprovantes das baixas e coloca o arquivo no campo de anexo do lançamento.
Nada passa por IA nem por servidor — os arquivos ficam guardados no próprio
navegador.

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
4. Abra o lançamento no Conta Azul e a área de **anexo** dele. O comprovante
   daquele lançamento aparece destacado (“provável deste lançamento”, pelo
   valor na tela).
5. Clique em **Anexar aqui**: o arquivo vai para o campo de anexo. **Confira e
   salve no Conta Azul.** Depois clique em **Já anexei** para tirar da lista.
6. Se o campo não for encontrado, use **Baixar arquivo** e anexe à mão.

## Limites desta primeira versão

- Ela procura o campo de arquivo que estiver aberto na tela (de preferência
  dentro da janela/modal). Se o Conta Azul usar um componente diferente, me
  mande prints da tela de anexo para ajustar.
- A lista fica guardada no navegador onde a extensão foi instalada.
