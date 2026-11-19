// node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const R = require('../reforma/reforma-core.js');
const fs = require('fs');
const path = require('path');
const dados = f => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'reforma', 'dados', f), 'utf8'));

const cheia = { cd: '000001', tipo_aliquota: 'Padrão', red: { CBS: 0, IBSUF: 0, IBSMun: 0 }, credito_adq: { CBS: true, IBS: true } };
const educacao = { cd: '200028', tipo_aliquota: 'Padrão', red: { CBS: 60, IBSUF: 60, IBSMun: 60 }, credito_adq: { CBS: true, IBS: true } };
const imune = { cd: '410999', tipo_aliquota: 'Sem alíquota', red: { CBS: 0, IBSUF: 0, IBSMun: 0 } };

test('alíquotas de cada fase da transição', () => {
  assert.deepStrictEqual(R.aliquotasAno(2026).cbs, 0.9);
  assert.strictEqual(R.aliquotasAno(2026).ibs_uf, 0.1);
  const a27 = R.aliquotasAno(2027, { cbs: 8.8, ibs_uf: 17.7, ibs_mun: 0 });
  assert.strictEqual(a27.cbs, 8.7);
  assert.strictEqual(a27.ibs_uf + a27.ibs_mun, 0.1);
  const a30 = R.aliquotasAno(2030, { cbs: 8.8, ibs_uf: 10, ibs_mun: 7 });
  assert.strictEqual(a30.ibs_uf, 2);
  assert.strictEqual(a30.ibs_mun, 1.4);
  assert.strictEqual(R.regrasAno(2030).legado, 0.8);
  assert.strictEqual(R.regrasAno(2033).legado, 0);
});

test('redução de 60% igual ao exemplo oficial da Receita (educação, 2027)', () => {
  // docs/exemplos.md da calculadora oficial: base 1.200, CBS 8,8% → efetiva 3,52% → R$ 42,24
  const l = R.calcularLinha(1200, educacao, { cbs: 8.8, ibs_uf: 0.05, ibs_mun: 0.05 });
  assert.strictEqual(l.efetivas.cbs, 3.52);
  assert.strictEqual(l.cbs, 42.24);
  assert.strictEqual(l.ibs_uf, 0.24);
  assert.strictEqual(l.ibs_mun, 0.24);
});

test('imunidade não gera tributo e compra sem crédito não abate', () => {
  const s = R.simular({ ano: 2033, ref: { cbs: 10, ibs_uf: 10, ibs_mun: 5 },
    receitas: [{ valor: 1000, cclass: cheia }, { valor: 500, cclass: imune }],
    compras: [{ valor: 200, cclass: cheia }, { valor: 100, cclass: cheia, credito: false }] });
  assert.strictEqual(s.debito.cbs, 100);
  assert.strictEqual(s.debito.ibs, 150);
  assert.strictEqual(s.credito.cbs, 20);
  assert.strictEqual(s.apagar.ibs, 120);
  assert.strictEqual(s.carga_nova, 200);
});

test('2026 é teste: não soma na carga; ICMS/ISS caem na proporção da transição', () => {
  const base = { ref: { cbs: 9, ibs_uf: 18, ibs_mun: 0 }, receitas: [{ valor: 10000, cclass: cheia }], atual: { icms: 0, iss: 500, pis_cofins: 365 } };
  const s26 = R.simular({ ...base, ano: 2026 });
  assert.strictEqual(s26.carga_nova, 865);
  const s29 = R.simular({ ...base, ano: 2029 });
  assert.strictEqual(s29.legado.iss, 450);
  assert.strictEqual(s29.legado.pis_cofins, 0);
  assert.strictEqual(s29.apagar.cbs, 900);
  assert.strictEqual(s29.apagar.ibs, 180);
  assert.strictEqual(R.projecao(base).length, 8);
});

test('Simples por dentro: IBS/CBS fica no DAS', () => {
  const s = R.simular({ ano: 2027, regime: 'simples', receitas: [{ valor: 1000, cclass: cheia }] });
  assert.strictEqual(s.carga_nova, 0);
  assert.ok(s.debito.cbs > 0);
});

test('tabelas oficiais exportadas e consultas', () => {
  const cc = dados('cclasstrib.json');
  assert.ok(cc.length > 150);
  const porId = Object.fromEntries(cc.map(c => [c.id, c]));
  const intelectuais = cc.find(c => c.cd === '200052');
  assert.strictEqual(intelectuais.red.CBS, 30);
  assert.ok(R.buscar(cc, 'profissoes intelectuais', ['cd', 'desc']).some(c => c.cd === '200052'));
  assert.ok(R.buscar(cc, '2000', ['cd', 'desc']).every(c => c.cd.startsWith('2000')));
  // Arroz (NCM 1006.30.21) → cesta básica (Anexo I)
  const arroz = R.classificacoesNcm('1006.30.21', dados('ncm_aplicavel.json'));
  assert.ok(arroz.some(a => a.anexo === 'I'));
  // Item 1.01 da LC 116 (desenvolvimento de sistemas) → tributação integral
  const s101 = dados('lc116.json').find(l => l.cd === '1.01');
  assert.ok(R.classificacoesServico(s101, porId).some(c => c.cd === '000001'));
});
