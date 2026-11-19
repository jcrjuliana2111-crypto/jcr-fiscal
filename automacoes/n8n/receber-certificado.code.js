// Nó "Preparar arquivo" do fluxo receber-certificado (n8n, nó Code em modo "Run Once for All Items").
// Recebe do portal (Edge Function certificados-vps) o certificado A1 em base64 e devolve o arquivo binário
// com o MESMO nome do arquivo original (a senha continua no nome, como o robô de notas já usa).
// Responde ao portal com o nome final gravado.
// Este arquivo é a fonte do código colado no nó (gerar-fluxos.py); mantenha os dois iguais.

const corpo = $('Recebe do portal').first().json.body || {};
const pasta = String($('Configuração').first().json.pasta || '').replace(/\/+$/, '');
const original = String(corpo.arquivo || '').replace(/^.*[\\/]/, '').trim();
// O robô lê a senha no nome do arquivo. Se a senha foi digitada no portal (não estava no nome),
// o arquivo é renomeado pelo padrão da Configuração, ex.: "{nome} - senha {senha}.pfx".
const senha = String(corpo.senha ?? '');
const padrao = String($('Configuração').first().json.padrao_nome || '{nome} - senha {senha}.pfx');
const semExt = original.replace(/\.(pfx|p12)$/i, '');
const arquivo = senha && !original.includes(senha)
  ? padrao.replace('{nome}', semExt).replace('{senha}', senha).replace(/[\\/]/g, '-')
  : original;
if (!pasta) throw new Error('Preencha a pasta dos certificados no nó Configuração.');
if (!/\.(pfx|p12)$/i.test(original) || arquivo.includes('..')) throw new Error('Nome de arquivo inválido: ' + arquivo);
if (!/^[A-Za-z0-9+/=]+$/.test(String(corpo.conteudo || ''))) throw new Error('Conteúdo do certificado inválido.');
return [{
  json: { arquivo, caminho: `${pasta}/${arquivo}`, documento: corpo.documento || '', titular: corpo.titular || '', vencimento: corpo.vencimento || null, enviado_por: corpo.enviado_por || '' },
  binary: { data: { data: corpo.conteudo, mimeType: 'application/x-pkcs12', fileName: arquivo } },
}];
