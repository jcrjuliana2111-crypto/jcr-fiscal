/*
 * Certificados digitais A1 (.pfx/.p12): achar a senha no nome do arquivo e ler titular e validade.
 * A leitura usa a biblioteca forge no navegador; o arquivo e a senha não saem do computador
 * (a não ser para a VPS do escritório, quando a pessoa pede). Funções testadas em tests/certificado.test.js.
 */
(function (root) {
  // Possíveis senhas escondidas no nome do arquivo, da mais provável para a menos provável.
  // Ex.: "EMPRESA LTDA - senha 1234.pfx", "12345678000199_Abc@123.pfx", "Fulano (senha: 9876).p12"
  function candidatosSenha(nomeArquivo) {
    const base = String(nomeArquivo || '').replace(/^.*[\\/]/, '').replace(/\.(pfx|p12)$/i, '').trim();
    const out = [];
    const add = s => { const t = String(s ?? '').trim(); if (!out.includes(t)) out.push(t); };
    const chave = /(?:senha|password|pass|pwd|pw|sen)\s*[:=#]?\s*[-_ ]?\s*(.+)$/i.exec(base);
    if (chave) { const v = chave[1].replace(/\s*[)\]}]+\s*$/, ''); add(v); add(v.split(/[\s_]+/)[0]); add(chave[1]); }
    const entre = /[([{]\s*(?:senha|pass|pwd)?\s*[:=]?\s*([^)\]}]+?)\s*[)\]}]/i.exec(base);
    if (entre) add(entre[1]);
    // separadores mais comuns entre nome e senha: " - ", "_", " ", "-"
    [/\s+-\s+/, /_+/, /\s+/, /-/].forEach(sep => {
      const p = base.split(sep).map(x => x.trim()).filter(Boolean);
      if (p.length > 1) { add(p[p.length - 1]); add(p.slice(1).join(sep.source === '\\s+' ? ' ' : sep.source === '_+' ? '_' : sep.source === '-' ? '-' : ' - ')); }
    });
    base.split(/[\s_\-–]+/).filter(t => t.length >= 3).forEach(add);
    add(base); add('');
    return out.filter(s => s !== undefined).slice(0, 40);
  }

  // Lê o PFX com a senha; devolve null se a senha não abrir. forge = biblioteca node-forge.
  function abrir(forge, bytes, senha) {
    try {
      const bin = forge.util.binary.raw.encode(bytes);
      const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(bin), senha);
      const certs = (p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || []).map(b => b.cert).filter(Boolean);
      const cert = certs.find(c => !(c.extensions || []).some(e => e.name === 'basicConstraints' && e.cA)) || certs[0];
      if (!cert) return null;
      return dadosCertificado((cert.subject.getField('CN') || {}).value || '', cert.validity.notBefore, cert.validity.notAfter);
    } catch (_) { return null; }
  }

  // Titular "EMPRESA LTDA:11222333000181" → { titular, nome, documento, tipo, emitido_em, vencimento }
  function dadosCertificado(cn, inicio, fim) {
    const [nome, doc] = String(cn).split(':');
    const documento = String(doc || '').replace(/\D/g, '');
    const iso = d => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null);
    return { titular: cn, nome: (nome || '').trim(), documento, tipo: documento.length === 14 ? 'e-CNPJ' : documento.length === 11 ? 'e-CPF' : 'certificado', emitido_em: iso(inicio), vencimento: iso(fim) };
  }

  // Tenta as senhas candidatas; devolve { senha, dados } ou null
  function descobrir(forge, bytes, nomeArquivo, extras = []) {
    for (const s of [...extras, ...candidatosSenha(nomeArquivo)]) {
      const dados = abrir(forge, bytes, s);
      if (dados) return { senha: s, dados };
    }
    return null;
  }

  /*
   * Converte o .pfx para o formato do robô da VPS: um único .pem com a chave privada aberta (PKCS#8,
   * "BEGIN PRIVATE KEY", igual ao "openssl pkcs12 -nodes") seguida do certificado e da cadeia.
   * Feito aqui no navegador: a senha não sai do computador.
   */
  function paraPem(forge, bytes, senha) {
    const bin = forge.util.binary.raw.encode(bytes);
    const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(bin), senha);
    const chaves = [...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || []),
      ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || [])].map(b => b.key).filter(Boolean);
    const certs = (p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || []).map(b => b.cert).filter(Boolean);
    if (!chaves.length || !certs.length) throw new Error('certificado sem chave privada');
    const folha = certs.find(c => !(c.extensions || []).some(e => e.name === 'basicConstraints' && e.cA)) || certs[0];
    const chave = forge.pki.privateKeyInfoToPem(forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(chaves[0])));
    return [chave, forge.pki.certificateToPem(folha), ...certs.filter(c => c !== folha).map(c => forge.pki.certificateToPem(c))].join('').replace(/\r\n/g, '\n');
  }

  const api = { candidatosSenha, abrir, descobrir, dadosCertificado, paraPem };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Certificado = api;
})(typeof window !== 'undefined' ? window : globalThis);
