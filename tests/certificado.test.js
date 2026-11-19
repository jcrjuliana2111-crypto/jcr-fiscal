// node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const C = require('../societario/certificado-core.js');

test('acha a senha no nome do arquivo em vários formatos', () => {
  const primeiro = n => C.candidatosSenha(n)[0];
  assert.strictEqual(primeiro('EMPRESA EXEMPLO LTDA - senha 1234.pfx'), '1234');
  assert.strictEqual(primeiro('Fulano de Tal (senha: Ab@987).p12'), 'Ab@987');
  assert.strictEqual(primeiro('cert_empresa_SENHA_xyz123.pfx'), 'xyz123');
  assert.ok(C.candidatosSenha('12345678000199_Abc@123.pfx').slice(0, 3).includes('Abc@123'));
  assert.ok(C.candidatosSenha('EMPRESA LTDA - Abc 123.pfx').includes('Abc 123'));
  assert.ok(C.candidatosSenha('EMPRESA LTDA 4567.pfx').includes('4567'));
  assert.ok(C.candidatosSenha('qualquer.pfx').includes(''));
  assert.ok(C.candidatosSenha('C:\\certs\\EMPRESA - 1234.pfx').includes('1234'));
});

test('dados do titular do certificado', () => {
  const d = C.dadosCertificado('EMPRESA EXEMPLO LTDA:11222333000181', new Date(2026, 0, 2), new Date(2027, 0, 2));
  assert.deepStrictEqual(d, { titular: 'EMPRESA EXEMPLO LTDA:11222333000181', nome: 'EMPRESA EXEMPLO LTDA', documento: '11222333000181', tipo: 'e-CNPJ', emitido_em: '2026-01-02', vencimento: '2027-01-02' });
  assert.strictEqual(C.dadosCertificado('FULANO:52998224725').tipo, 'e-CPF');
});
