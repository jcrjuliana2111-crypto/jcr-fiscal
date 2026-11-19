// node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const T = require('../fiscal/transicao-core.js');
const ids = l => l.flatMap(g => g.itens.map(i => i.id));

test('todas as transições entre os 4 regimes geram lista, sem ids repetidos', () => {
  for (const o of T.REGIMES) for (const d of T.REGIMES) {
    if (o === d) { assert.deepStrictEqual(T.gerar({ origem: o, destino: d }), []); continue; }
    for (const motivo of T.motivosPara(o, d)) {
      const l = T.gerar({ origem: o, destino: d, motivo, comercio: true, folha: true });
      const lista = ids(l);
      assert.ok(lista.length >= 8, `${o} → ${d} (${motivo}) com poucos itens`);
      assert.strictEqual(new Set(lista).size, lista.length, `${o} → ${d}: id repetido`);
      assert.ok(lista.includes('sis_portal'));
    }
  }
});

test('MEI → Simples por excesso: desenquadramento, DASN e regra dos 20%', () => {
  const l = ids(T.gerar({ origem: 'MEI', destino: 'Simples Nacional', motivo: 'excesso' }));
  assert.ok(['dec_mei_comunicar', 'dec_mei_excesso', 'enc_mei_dasn', 'ent_sn_anexo', 'ent_sn_ibs'].every(i => l.includes(i)));
  assert.ok(!l.includes('dec_sn_opcao'), 'ex-MEI não precisa de nova opção pelo Simples');
});

test('Simples → Presumido: exclusão conforme o motivo, folha e ICMS só quando se aplica', () => {
  const debito = ids(T.gerar({ origem: 'Simples Nacional', destino: 'Lucro Presumido', motivo: 'debito' }));
  assert.ok(debito.includes('dec_sn_exclusao_debito') && !debito.includes('dec_sn_exclusao_opcao'));
  assert.ok(debito.includes('dec_lp_opcao') && debito.includes('ent_lp_lc224'));
  assert.ok(!debito.includes('ent_folha_inss') && !debito.includes('ent_icms_rpa') && !debito.includes('enc_sn_estoque'));
  const comFolha = ids(T.gerar({ origem: 'Simples Nacional', destino: 'Lucro Presumido', motivo: 'opcao', comercio: true, folha: true }));
  assert.ok(comFolha.includes('ent_folha_inss') && comFolha.includes('ent_icms_rpa') && comFolha.includes('enc_sn_estoque'));
});

test('Real → Presumido e Real → Simples: prejuízo, diferidos e créditos', () => {
  const l = ids(T.gerar({ origem: 'Lucro Real', destino: 'Lucro Presumido' }));
  assert.ok(['dec_lr_lp_requisito', 'enc_lr_prejuizo', 'enc_lr_diferidos', 'enc_lr_creditos'].every(i => l.includes(i)));
  const s = ids(T.gerar({ origem: 'Lucro Real', destino: 'Simples Nacional' }));
  assert.ok(s.includes('dec_sn_opcao') && s.includes('enc_lr_debitos'));
});

test('Simples → MEI exige EI; progresso conta os feitos', () => {
  const l = T.gerar({ origem: 'Simples Nacional', destino: 'MEI' });
  assert.ok(ids(l).includes('enc_sn_ltda_ei') && ids(l).includes('dec_mei_opcao'));
  assert.deepStrictEqual(T.motivosPara('Simples Nacional', 'MEI'), ['opcao']);
  const p = T.progresso(l, { dec_mei_opcao: '2027-01-10', enc_sn_ltda_ei: '2026-12-01' });
  assert.strictEqual(p.feitos, 2); assert.ok(p.pct > 0 && p.pct < 100);
});
