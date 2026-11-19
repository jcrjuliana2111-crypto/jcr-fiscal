// node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const C = require('../societario/cofre-core.js');
const IT = 1000; // iterações reduzidas só no teste (no portal são 600 mil)

test('guarda e abre o certificado; o pacote não mostra nome, senha nem conteúdo', async () => {
  const bytes = new Uint8Array([48, 130, 1, 2, 3, 4, 5, 250, 251]);
  const pacote = await C.guardarCertificado('Cofre2026forte', { nome: 'EMPRESA - senha 1234.pfx', senha: '1234', documento: '11222333000181', bytes }, IT);
  const texto = Buffer.from(pacote).toString('latin1');
  assert.ok(texto.startsWith('JCRCOFRE1'));
  assert.ok(!texto.includes('1234') && !texto.includes('EMPRESA') && !texto.includes('11222333000181'));
  const aberto = await C.abrirCertificado('Cofre2026forte', pacote, IT);
  assert.strictEqual(aberto.nome, 'EMPRESA - senha 1234.pfx');
  assert.strictEqual(aberto.senha, '1234');
  assert.deepStrictEqual([...aberto.bytes], [...bytes]);
});

test('senha errada e arquivo adulterado não abrem', async () => {
  const pacote = await C.guardarCertificado('Cofre2026forte', { nome: 'a.pfx', bytes: new Uint8Array([1, 2, 3]) }, IT);
  await assert.rejects(C.abrirCertificado('outraSenha123', pacote, IT), /Senha do cofre errada/);
  const adulterado = pacote.slice(); adulterado[adulterado.length - 1] ^= 1;
  await assert.rejects(C.abrirCertificado('Cofre2026forte', adulterado, IT), /errada|alterado/);
  await assert.rejects(C.decifrar('x', new Uint8Array([1, 2, 3]), IT), /inválido/);
  // dois envios do mesmo arquivo geram pacotes diferentes (sal e iv aleatórios)
  const p2 = await C.guardarCertificado('Cofre2026forte', { nome: 'a.pfx', bytes: new Uint8Array([1, 2, 3]) }, IT);
  assert.notDeepStrictEqual([...pacote], [...p2]);
});

test('verificador confere a senha do cofre; regras mínimas da senha', async () => {
  const v = await C.criarVerificador('Cofre2026forte', IT);
  assert.strictEqual(await C.conferirSenha('Cofre2026forte', v, IT), true);
  assert.strictEqual(await C.conferirSenha('errada', v, IT), false);
  assert.ok(C.senhaFraca('123'));
  assert.ok(C.senhaFraca('soletrasmesmo'));
  assert.strictEqual(C.senhaFraca('Cofre2026forte'), '');
  assert.strictEqual(C.ITERACOES, 600000);
});
