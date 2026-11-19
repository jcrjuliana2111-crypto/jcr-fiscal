// Nó "Ler validade dos certificados" do fluxo sincronizar-certificados (n8n, nó Code em modo "Run Once for All Items").
// Recebe os arquivos <CNPJ>.pem da pasta do robô (nó "Ler a pasta do robô") e, para cada um, lê no próprio
// certificado: titular (CN), início e fim da validade. Não usa biblioteca nenhuma: decodifica o X.509 (ASN.1/DER).
// Devolve um item por certificado para gravar no portal (função registrar_certificado). A chave privada não é lida.
// Este arquivo é a fonte do código colado no nó (gerar-fluxos.py); mantenha os dois iguais.

function lerDer(bytes) {
  // Percorre o DER: devolve { tag, inicio, fim, filhos? }
  function no(i) {
    const tag = bytes[i]; let len = bytes[i + 1], p = i + 2;
    if (len & 0x80) { const n = len & 0x7f; len = 0; for (let k = 0; k < n; k++) len = len * 256 + bytes[p++]; }
    return { tag, inicio: p, fim: p + len };
  }
  const filhos = n => { const out = []; let i = n.inicio; while (i < n.fim) { const f = no(i); out.push(f); i = f.fim; } return out; };
  const texto = n => String.fromCharCode(...bytes.slice(n.inicio, n.fim));
  const data = n => { // UTCTime (0x17) AAMMDDhhmmssZ ou GeneralizedTime (0x18) AAAAMMDDhhmmssZ
    const t = texto(n); const ano = n.tag === 0x17 ? (+t.slice(0, 2) >= 50 ? 1900 : 2000) + +t.slice(0, 2) : +t.slice(0, 4); const r = n.tag === 0x17 ? t.slice(2) : t.slice(4);
    return new Date(Date.UTC(ano, +r.slice(0, 2) - 1, +r.slice(2, 4), +r.slice(4, 6), +r.slice(6, 8), +r.slice(8, 10)));
  };
  const cert = no(0), tbs = filhos(cert)[0]; let campos = filhos(tbs);
  if (campos[0].tag === 0xa0) campos = campos.slice(1); // versão
  const validade = filhos(campos[3]), sujeito = campos[4];
  let cn = '';
  for (const rdn of filhos(sujeito)) for (const atv of filhos(rdn)) {
    const [oid, valor] = filhos(atv);
    if (bytes.slice(oid.inicio, oid.fim).join('.') === '85.4.3') cn = decodeURIComponent(escape(texto(valor))); // 2.5.4.3 = commonName
  }
  return { cn, inicio: data(validade[0]), fim: data(validade[1]) };
}
const iso = d => d.toISOString().slice(0, 10);
const saida = [];
const itens = $input.all();
for (let i = 0; i < itens.length; i++) {
  const bin = (itens[i].binary || {}).data || {};
  const nome = bin.fileName || '';
  try {
    const buf = this && this.helpers && this.helpers.getBinaryDataBuffer ? await this.helpers.getBinaryDataBuffer(i, 'data') : Buffer.from(bin.data, 'base64');
    const pem = buf.toString('utf8');
    const b64 = (/-----BEGIN CERTIFICATE-----([\s\S]+?)-----END CERTIFICATE-----/.exec(pem) || [])[1];
    if (!b64) throw new Error('sem certificado no arquivo');
    const c = lerDer(Uint8Array.from(Buffer.from(b64.replace(/\s+/g, ''), 'base64')));
    const doc = (nome.replace(/\.pem$/i, '').replace(/\D/g, '')) || (c.cn.split(':')[1] || '').replace(/\D/g, '');
    saida.push({ json: { documento: doc, titular: c.cn, vencimento: iso(c.fim), emitido_em: iso(c.inicio), arquivo: nome } });
  } catch (e) {
    saida.push({ json: { erro: `${nome}: ${e.message}` } });
  }
}
return saida.filter(x => !x.json.erro || $('Configuração').first().json.mostrar_erros);
