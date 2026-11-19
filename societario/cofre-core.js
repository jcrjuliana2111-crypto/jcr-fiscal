/*
 * Cofre de certificados: criptografia feita no navegador (Web Crypto, nativa), antes de qualquer envio.
 *   chave = PBKDF2-SHA256(senha do cofre, sal aleatório de 16 bytes, 600.000 iterações) → AES-256-GCM
 *   arquivo guardado = "JCRCOFRE1" + sal + iv (12 bytes) + texto cifrado (com a etiqueta de integridade do GCM)
 * O conteúdo cifrado é um JSON { v, nome, senha, documento, pfx (base64) }: o nome original do arquivo e a
 * senha do certificado também ficam protegidos. Sem a senha do cofre, ninguém abre (nem o servidor).
 * Testado em tests/cofre.test.js.
 */
(function (root) {
  const ITERACOES = 600000;
  const MAGICO = new TextEncoder().encode('JCRCOFRE1');
  const VERIFICADOR = 'cofre-jcr-ok';
  const cripto = () => (root.crypto && root.crypto.subtle ? root.crypto : globalThis.crypto);

  async function derivarChave(senha, sal, iteracoes = ITERACOES) {
    const c = cripto();
    const base = await c.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveKey']);
    return c.subtle.deriveKey({ name: 'PBKDF2', salt: sal, iterations: iteracoes, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  const paraB64 = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192)); return btoa(s); };
  const deB64 = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

  // Criptografa bytes quaisquer com a senha do cofre
  async function cifrar(senhaCofre, bytes, iteracoes = ITERACOES) {
    if (!senhaCofre) throw new Error('Informe a senha do cofre.');
    const c = cripto(), sal = c.getRandomValues(new Uint8Array(16)), iv = c.getRandomValues(new Uint8Array(12));
    const chave = await derivarChave(senhaCofre, sal, iteracoes);
    const cifrado = new Uint8Array(await c.subtle.encrypt({ name: 'AES-GCM', iv }, chave, bytes));
    const out = new Uint8Array(MAGICO.length + 16 + 12 + cifrado.length);
    out.set(MAGICO, 0); out.set(sal, MAGICO.length); out.set(iv, MAGICO.length + 16); out.set(cifrado, MAGICO.length + 28);
    return out;
  }

  // Abre; senha errada ou arquivo alterado → erro "Senha do cofre errada…"
  async function decifrar(senhaCofre, pacote, iteracoes = ITERACOES) {
    const b = pacote instanceof Uint8Array ? pacote : new Uint8Array(pacote);
    if (b.length < MAGICO.length + 29 || !MAGICO.every((x, i) => b[i] === x)) throw new Error('Arquivo do cofre inválido.');
    const sal = b.slice(MAGICO.length, MAGICO.length + 16), iv = b.slice(MAGICO.length + 16, MAGICO.length + 28);
    try {
      const chave = await derivarChave(senhaCofre, sal, iteracoes);
      return new Uint8Array(await cripto().subtle.decrypt({ name: 'AES-GCM', iv }, chave, b.slice(MAGICO.length + 28)));
    } catch (_) { throw new Error('Senha do cofre errada (ou arquivo alterado).'); }
  }

  // Certificado completo para o cofre
  async function guardarCertificado(senhaCofre, { nome, senha, documento, bytes }, iteracoes) {
    const json = JSON.stringify({ v: 1, nome, senha: senha ?? '', documento: documento || '', pfx: paraB64(bytes) });
    return cifrar(senhaCofre, new TextEncoder().encode(json), iteracoes);
  }
  async function abrirCertificado(senhaCofre, pacote, iteracoes) {
    const d = JSON.parse(new TextDecoder().decode(await decifrar(senhaCofre, pacote, iteracoes)));
    return { nome: d.nome, senha: d.senha, documento: d.documento, bytes: deB64(d.pfx) };
  }

  // Verificador da senha do cofre (guardado no banco): confirma a senha sem revelá-la
  async function criarVerificador(senhaCofre, iteracoes) { return paraB64(await cifrar(senhaCofre, new TextEncoder().encode(VERIFICADOR), iteracoes)); }
  async function conferirSenha(senhaCofre, verificador, iteracoes) {
    try { return new TextDecoder().decode(await decifrar(senhaCofre, deB64(verificador), iteracoes)) === VERIFICADOR; } catch (_) { return false; }
  }

  // Regras mínimas da senha do cofre
  function senhaFraca(s) {
    const t = String(s || '');
    if (t.length < 10) return 'Use pelo menos 10 caracteres.';
    if (!/[a-zA-Z]/.test(t) || !/\d/.test(t)) return 'Misture letras e números.';
    return '';
  }

  const api = { ITERACOES, cifrar, decifrar, guardarCertificado, abrirCertificado, criarVerificador, conferirSenha, senhaFraca, paraB64, deB64 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Cofre = api;
})(typeof window !== 'undefined' ? window : globalThis);
