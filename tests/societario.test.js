// node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const S = require('../societario/societario-core.js');

test('etapas da abertura dependem do fluxo: DBE só no tradicional', () => {
  const rapido = S.etapasPadrao('abertura', 'rapido', 'LTDA').map(e => e.id);
  const trad = S.etapasPadrao('abertura', 'tradicional', 'LTDA').map(e => e.id);
  assert.ok(!rapido.includes('dbe'));
  assert.ok(trad.includes('dbe'));
  assert.strictEqual(trad.length, rapido.length + 1);
  assert.ok(S.etapasPadrao('abertura', 'rapido').every(e => e.feito === false && e.data === null));
});

test('desenquadramento do SIMEI só entra na transformação de MEI', () => {
  assert.ok(S.etapasPadrao('transformacao', 'tradicional', 'MEI').some(e => e.id === 'simei'));
  assert.ok(!S.etapasPadrao('transformacao', 'tradicional', 'EI').some(e => e.id === 'simei'));
  assert.deepStrictEqual(S.etapasPadrao('inexistente'), []);
});

test('progresso conta etapas feitas e aponta a próxima', () => {
  let etapas = S.etapasPadrao('baixa');
  etapas = S.marcarEtapa(etapas, 'cnpj', true, '2026-11-10');
  const p = S.progresso({ etapas });
  assert.strictEqual(p.feitas, 1);
  assert.strictEqual(p.total, 7);
  assert.strictEqual(p.pct, 14);
  assert.strictEqual(p.proxima, 'Inscrição estadual baixada (SEFAZ)');
  assert.strictEqual(etapas[0].data, '2026-11-10');
  assert.strictEqual(S.marcarEtapa(etapas, 'cnpj', false, '2026-11-11')[0].data, null);
  assert.strictEqual(S.progresso({ etapas: [] }).pct, 0);
});

test('situação: exigência vence em 30 dias e processo sem movimento fica parado', () => {
  const hoje = '2026-11-12';
  assert.strictEqual(S.prazoExigencia({ exigencia_em: '2026-10-20' }), '2026-11-19');
  assert.strictEqual(S.situacao({ status: 'exigencia', exigencia_em: '2026-10-20' }, hoje), 'exigencia');
  assert.strictEqual(S.situacao({ status: 'exigencia', exigencia_em: '2026-10-10' }, hoje), 'exigencia_vencida');
  assert.strictEqual(S.situacao({ status: 'andamento', iniciado_em: '2026-11-01', etapas: [] }, hoje), 'parado');
  const etapas = [{ id: 'docs', feito: true, data: '2026-11-10' }];
  assert.strictEqual(S.situacao({ status: 'andamento', iniciado_em: '2026-11-01', etapas }, hoje), 'andamento');
  assert.strictEqual(S.situacao({ status: 'concluido' }, hoje), 'concluido');
});

test('texto de documentos para o cliente', () => {
  const t = S.textoDocumentos('abertura', 'Padaria Boa LTDA');
  assert.ok(t.startsWith('Olá! Para darmos andamento à abertura de Padaria Boa LTDA'));
  assert.ok(t.includes('• IPTU (ou INCRA) do endereço da empresa'));
});
