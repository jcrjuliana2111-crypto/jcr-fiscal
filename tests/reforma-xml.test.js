// node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const X = require('../reforma/xml-core.js');
const fx = f => fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8');
const dados = f => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'reforma', 'dados', f), 'utf8'));
const tabelas = { cclass: dados('cclasstrib.json'), ncm_aplicavel: dados('ncm_aplicavel.json'), nbs_aplicavel: dados('nbs_aplicavel.json'), lc116: dados('lc116.json') };

test('lê NF-e: emitente, itens, desconto e grupo IBSCBS', () => {
  const n = X.lerXml(fx('nfe-exemplo.xml'));
  assert.strictEqual(n.tipo, 'NF-e');
  assert.strictEqual(n.chave.length, 44);
  assert.strictEqual(n.emitente.nome, 'EMPRESA EXEMPLO LTDA');
  assert.strictEqual(n.municipio, 3552403);
  assert.strictEqual(n.itens.length, 2);
  assert.strictEqual(n.itens[0].valor, 240);
  assert.strictEqual(n.itens[0].cclass_nota, '200003');
  assert.strictEqual(n.itens[1].descricao, 'PARAFUSO & PORCA');
});

test('lê NFS-e nacional: serviço da LC 116 pelo cTribNac', () => {
  const n = X.lerXml(fx('nfse-exemplo.xml'));
  assert.strictEqual(n.tipo, 'NFS-e');
  assert.strictEqual(n.itens[0].item_lc116, '17.19');
  assert.strictEqual(n.itens[0].valor, 3500);
  assert.strictEqual(n.municipio, 3552403);
  assert.throws(() => X.lerXml('<a/>'), /não reconhecido/);
});

test('agrupa notas e sugere cClassTrib: arroz na cesta básica, contabilidade −30%, parafuso regra geral', () => {
  const g = X.agrupar([X.lerXml(fx('nfe-exemplo.xml')), X.lerXml(fx('nfe-exemplo.xml')), X.lerXml(fx('nfse-exemplo.xml'))]);
  assert.strictEqual(g.length, 3);
  const arroz = g.find(i => i.codigo === 'A1');
  assert.strictEqual(arroz.valor, 480);
  assert.strictEqual(arroz.notas, 2);
  assert.ok(X.sugerir(arroz, tabelas).some(s => s.cclass.cd === '200003'));
  const servico = g.find(i => i.item_lc116 === '17.19');
  assert.strictEqual(X.sugerir(servico, tabelas)[0].cclass.cd, '200052');
  const parafuso = g.find(i => i.codigo === 'B7');
  assert.strictEqual(X.sugerir(parafuso, tabelas)[0].cclass.cd, '000001');
});

test('monta a operação da calculadora oficial e lê a resposta oficial', () => {
  const op = X.operacao({ data: '2027-03-10', uf: 'SP', municipio: 3552403, aliquotas: { cbs: 8.8, ibs_uf: 0.05, ibs_mun: 0.05 },
    itens: [{ nbs: '1220.11.200', cst: '200', cClassTrib: '200028', baseCalculo: 1200 }] });
  assert.strictEqual(op.itens[0].nbs, '122011200');
  assert.deepStrictEqual(op.itens[0].aliquotasNominais, { cbs: 8.8, ibsEstadual: 0.05, ibsMunicipal: 0.05 });
  assert.ok(!X.operacao({ data: '2026-11-10', uf: 'SP', municipio: 1, itens: [{ cst: '000', cClassTrib: '000001', baseCalculo: 1 }] }).itens[0].aliquotasNominais);
  // resposta gerada pela calculadora oficial da Receita (fixtures/rtc-observabilidade.json)
  const r = X.resumoResposta(JSON.parse(fx('rtc-observabilidade.json')));
  assert.strictEqual(r[0].cbs.v, 42.24);
  assert.strictEqual(r[0].cbs.efet, 3.52);
  assert.strictEqual(r[0].ibs, 0.48);
  assert.strictEqual(r[2].estado, 'INCONSISTENCIA_ENTRADA');
  assert.strictEqual(r[2].erros[0].code, 'REG-011');
});

test('CSV com ponto e vírgula e aspas', () => {
  assert.strictEqual(X.csv([['a;b', 'c"d', 1]]), '"a;b";"c""d";1');
});
