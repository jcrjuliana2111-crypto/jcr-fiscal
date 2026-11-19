// node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const L = require('../societario/links.js');
const S = require('../societario/societario-core.js');

test('links da etapa trazem os da prefeitura quando o município tem cadastro', () => {
  const campinas = L.daEtapa('viabilidade', 'Campinas').map(l => l.nome);
  assert.ok(campinas[0].startsWith('Campinas — Zoneamento'));
  assert.ok(campinas.some(n => n.startsWith('Via Rápida Empresa')));
  const outra = L.daEtapa('viabilidade', 'Sumaré').map(l => l.nome);
  assert.ok(!outra.some(n => n.startsWith('Campinas')));
  assert.ok(outra.some(n => n.startsWith('Via Rápida Empresa')));
  assert.ok(L.municipio('CAMPINAS') && L.municipio('campinas'));
});

test('todo link é https (ou interno) e toda chave usada nas etapas existe', () => {
  const todos = [...Object.values(L.LINKS), ...Object.values(L.MUNICIPIOS).flatMap(m => Object.values(m.links))];
  todos.forEach(l => assert.ok(l.interno || /^https?:\/\//.test(l.url), l.nome));
  todos.filter(l => l.url.startsWith('http://')).forEach(l => assert.ok(l.conferir, 'http sem https precisa estar marcado para conferir: ' + l.nome));
  const chaves = new Set([...Object.keys(L.LINKS), ...Object.values(L.MUNICIPIOS).flatMap(m => Object.keys(m.links))]);
  Object.values(L.ETAPAS).flat().forEach(k => assert.ok(chaves.has(k), k));
});

test('etapas do painel com links úteis', () => {
  ['abertura', 'alteracao', 'transformacao', 'encerramento'].forEach(t => {
    const comLink = S.etapasPadrao(t, 'tradicional', 'MEI').filter(e => L.daEtapa(e.id, 'Campinas').length);
    assert.ok(comLink.length >= 3, t);
  });
});

test('Sumaré tem viabilidade, inscrição e ISS', () => {
  const L2 = require('../societario/links.js');
  const v = L2.daEtapa('viabilidade', 'Sumaré').map(l => l.nome).join(' | ');
  assert.ok(v.startsWith('Sumaré'));
  assert.ok(L2.daEtapa('ccm', 'SUMARE').some(l => /SIGISS/.test(l.nome)));
});
