// Nó "Preparar arquivo" do fluxo receber-certificado (n8n, nó Code em modo "Run Once for All Items").
// Recebe do portal (Edge Function certificados-vps) o certificado JÁ CONVERTIDO para .pem no navegador
// (chave privada aberta + certificado), igual ao que o robô de notas grava, e devolve o arquivo binário
// "<CNPJ>.pem" para a pasta do robô (certs-nfse). Se já existir, é substituído (renovação).
// Este arquivo é a fonte do código colado no nó (gerar-fluxos.py); mantenha os dois iguais.

const corpo = $('Recebe do portal').first().json.body || {};
const pasta = String($('Configuração').first().json.pasta || '').replace(/\/+$/, '');
const documento = String(corpo.documento || '').replace(/\D/g, '');
const conteudo = String(corpo.conteudo || '');
if (!pasta) throw new Error('Preencha a pasta dos certificados no nó Configuração.');
if (![11, 14].includes(documento.length)) throw new Error('CNPJ/CPF inválido: ' + corpo.documento);
if (!/^[A-Za-z0-9+/=]+$/.test(conteudo)) throw new Error('Conteúdo do certificado inválido.');
const texto = typeof Buffer !== 'undefined' ? Buffer.from(conteudo, 'base64').toString('utf8') : atob(conteudo);
if (!/-----BEGIN (RSA )?PRIVATE KEY-----/.test(texto) || !/-----BEGIN CERTIFICATE-----/.test(texto)) throw new Error('O arquivo não tem chave privada e certificado em PEM.');
const arquivo = `${documento}.pem`;
return [{
  json: { arquivo, caminho: `${pasta}/${arquivo}`, documento, titular: corpo.titular || '', vencimento: corpo.vencimento || null, enviado_por: corpo.enviado_por || '' },
  binary: { data: { data: conteudo, mimeType: 'application/x-pem-file', fileName: arquivo } },
}];
