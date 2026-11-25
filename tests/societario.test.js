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

test('holding: abertura de holding aponta para o procedimento de holding', () => {
  const S = require('../societario/societario-core.js');
  assert.strictEqual(S.procedimentoDe({ tipo: 'abertura', empresa: 'ROCHA HOLDING PATRIMONIAL LTDA' }), 'holding');
  assert.strictEqual(S.procedimentoDe({ tipo: 'abertura', empresa: 'Família Silva Participações', dados: { empresa: { objeto: ['64.62-0-00 - Holdings de instituições não-financeiras'] } } }), 'holding');
  assert.strictEqual(S.procedimentoDe({ tipo: 'abertura', empresa: 'Padaria Pão Bom' }), S.TIPOS.abertura.proc);
  assert.strictEqual(S.procedimentoDe({ tipo: 'encerramento', empresa: 'X HOLDING' }), S.TIPOS.encerramento.proc);
});

test('processo em papel: etapas de impressão, protocolo e retirada; troca sem perder etapas marcadas', () => {
  const S = require('../societario/societario-core.js');
  const dig = S.etapasPadrao('abertura', 'rapido', 'LTDA').map(e => e.id);
  const pap = S.etapasPadrao('abertura', 'rapido', 'LTDA', 'papel').map(e => e.id);
  assert.ok(dig.includes('assinaturas') && !dig.includes('retirada'));
  assert.ok(!pap.includes('assinaturas') && pap.indexOf('impressao') < pap.indexOf('dare') && pap.indexOf('protocolo') === pap.indexOf('dare') + 1 && pap.indexOf('retirada') === pap.indexOf('deferimento') + 1);
  const p = { tipo: 'transformacao', fluxo: 'rapido', natureza: 'LTDA', etapas: S.etapasPadrao('transformacao', 'rapido', 'LTDA').map(e => (['docs', 'assinaturas'].includes(e.id) ? { ...e, feito: true, data: '2026-10-28' } : e)) };
  const novas = S.ajustarEtapas(p, 'papel');
  assert.ok(novas.find(e => e.id === 'docs').feito, 'marcada continua');
  assert.ok(novas.find(e => e.id === 'assinaturas'), 'etapa marcada que saiu do modelo não some');
  assert.ok(novas.some(e => e.id === 'protocolo' && !e.feito));
  const def = { entrada: 'papel', status: 'concluido', etapas: [{ id: 'deferimento', feito: true, data: '2026-11-01' }, { id: 'retirada', feito: false }] };
  assert.deepStrictEqual(S.retiradaPendente(def, '2026-11-25'), { desde: '2026-11-01', restam: 66 });
  assert.strictEqual(S.retiradaPendente({ ...def, entrada: 'digital' }, '2026-11-25'), null);
});

test('taxa da JUCESP 2026 pelo tipo, natureza e porte', () => {
  const S = require('../societario/societario-core.js');
  assert.strictEqual(S.taxaJucesp({ tipo: 'abertura', natureza: 'LTDA', dados: { empresa: { enquadramento: 'ME' } } }).valor, 218.99);
  assert.strictEqual(S.taxaJucesp({ tipo: 'abertura', natureza: 'LTDA', dados: { empresa: { enquadramento: '' } } }).valor, 273.55);
  assert.strictEqual(S.taxaJucesp({ tipo: 'abertura', natureza: 'EI', dados: { empresa: { enquadramento: 'ME' } } }).valor, 94.90);
  assert.strictEqual(S.taxaJucesp({ tipo: 'baixa' }), null);
});
