// node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const L = require('../societario/licencas.js');

test('lê CNAE em vários formatos', () => {
  assert.deepStrictEqual(L.cnaesDoTexto('Hemoterapia (CNAE 86.40-2-12) e 6920-6/01; também 4611700'), ['8640212', '6920601', '4611700']);
  assert.strictEqual(L.formatarCnae('8640212'), '8640-2/12');
});

test('contabilidade → CRC; representação → CORE; advocacia bloqueia a Junta', () => {
  const ids = L.alertas(['Serviços contábeis (CNAE 6920-6/01)', 'Representante comercial de produtos alimentícios (CNAE 4617-6/00)']).map(a => a.id);
  assert.ok(ids.includes('contabil') && ids.includes('representacao'));
  const adv = L.alertas('Serviços advocatícios 6911-7/01');
  assert.strictEqual(adv[0].id, 'advocacia');
  assert.strictEqual(adv[0].nivel, 'bloqueia');
});

test('hemoterapia: CRM, licença sanitária e regra própria', () => {
  const ids = L.alertas(['Serviços de hemoterapia (CNAE 8640-2/12)']).map(a => a.id);
  assert.deepStrictEqual(ids.sort(), ['hemoterapia', 'medicina', 'saude_visa']);
});

test('holding de imóveis próprios não pede CRECI; corretagem pede', () => {
  assert.deepStrictEqual(L.alertas(['Holdings de instituições não financeiras (6462-0/00)', 'Aluguel de imóveis próprios (6810-2/02)']), []);
  assert.strictEqual(L.alertas('Corretagem no aluguel de imóveis (6821-8/02)')[0].orgao, 'CRECI-SP');
});

test('sem CNAE, casa por palavra; com CNAE, só pelo código', () => {
  assert.ok(L.alertas('Escritório de contabilidade').some(a => a.id === 'contabil'));
  assert.deepStrictEqual(L.alertas('Consultoria contábil em tecnologia (CNAE 6204-0/00)'), []);
});

test('busca na lista completa', () => {
  assert.ok(L.buscar('CRECI').some(r => r.id === 'imobiliaria'));
  assert.ok(L.buscar('4930').some(r => r.id === 'transporte_cargas'));
});
