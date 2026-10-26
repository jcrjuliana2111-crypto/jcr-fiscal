// node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const R = require('../relatorios/relatorios-core.js');

const ev = (id, tipo, categoria, o) => ({ id, tipo, categoria, descricao: '', contato: '', vencimento: '2026-09-10', competencia: '', dataPagamento: '', total: 0, aberto: 0, pago: 0, ...o });
const base = [
  ev('r1', 'receber', 'Vendas de serviços', { competencia: '2026-09-05', total: 10000, pago: 10000, dataPagamento: '2026-09-12' }),
  ev('r2', 'receber', 'Vendas de serviços', { competencia: '2026-09-20', vencimento: '2026-10-20', total: 5000, aberto: 5000 }),
  ev('d1', 'pagar', 'Simples Nacional', { competencia: '2026-09-30', vencimento: '2026-10-20', total: 900, aberto: 900 }),
  ev('d2', 'pagar', 'Medicamentos', { competencia: '2026-09-10', total: 3000, pago: 3000, dataPagamento: '2026-09-15' }),
  ev('d3', 'pagar', 'Folha de pagamento', { competencia: '2026-09-30', vencimento: '2026-10-05', total: 4000, pago: 4000, dataPagamento: '2026-10-05' }),
  ev('d4', 'pagar', 'Tarifas bancárias', { competencia: '2026-09-02', total: 100, pago: 100, dataPagamento: '2026-09-02' }),
  ev('d5', 'pagar', 'Empréstimo capital de giro', { competencia: '2026-09-21', total: 2000, pago: 2000, dataPagamento: '2026-09-21' })
];

test('períodos: anterior e ano anterior', () => {
  assert.deepStrictEqual(R.periodoAnterior('2026-09-01', '2026-09-30'), { de: '2026-08-01', ate: '2026-08-31' });
  assert.deepStrictEqual(R.periodoAnterior('2026-07-01', '2026-09-30'), { de: '2026-04-01', ate: '2026-06-30' });
  assert.deepStrictEqual(R.periodoAnterior('2026-09-10', '2026-09-19'), { de: '2026-08-31', ate: '2026-09-09' });
  assert.deepStrictEqual(R.anoAnterior('2024-02-01', '2024-02-29'), { de: '2023-02-01', ate: '2023-02-28' });
  assert.deepStrictEqual(R.presetPeriodo('trimestre', '2026-10-26'), { de: '2026-10-01', ate: '2026-12-31' });
});

test('palpite de grupo pela categoria', () => {
  assert.strictEqual(R.palpiteGrupo('Simples Nacional', 'pagar'), 'deducoes');
  assert.strictEqual(R.palpiteGrupo('Folha de pagamento', 'pagar'), 'pessoal');
  assert.strictEqual(R.palpiteGrupo('Medicamentos', 'pagar'), 'custos');
  assert.strictEqual(R.palpiteGrupo('Tarifas bancárias', 'pagar'), 'despFinanceiras');
  assert.strictEqual(R.palpiteGrupo('Empréstimo capital de giro', 'pagar'), 'fora');
  assert.strictEqual(R.palpiteGrupo('Aluguel', 'pagar'), 'administrativas');
  assert.strictEqual(R.palpiteGrupo('Rendimentos de aplicação', 'receber'), 'recFinanceiras');
  assert.strictEqual(R.palpiteGrupo('Resgate de aplicação', 'receber'), 'fora');
  assert.strictEqual(R.palpiteGrupo('Juros recebidos', 'receber'), 'recFinanceiras');
});

test('DRE por competência e por caixa', () => {
  const c = R.montarDRE(base, {}, '2026-09-01', '2026-09-30', 'competencia');
  assert.deepStrictEqual([c.receitaBruta, c.receitaLiquida, c.lucroBruto, c.resultadoOperacional, c.resultadoFinanceiro, c.resultadoLiquido],
    [15000, 14100, 11100, 7100, -100, 7000]);
  assert.strictEqual(c.grupos.fora.total, 2000); // empréstimo não entra no resultado
  const k = R.montarDRE(base, {}, '2026-09-01', '2026-09-30', 'caixa');
  assert.deepStrictEqual([k.receitaBruta, k.lucroBruto, k.resultadoLiquido], [10000, 7000, 6900]); // folha paga em outubro
  // mapa manual muda o grupo
  const m = R.montarDRE(base, { 'pagar|Medicamentos': 'administrativas' }, '2026-09-01', '2026-09-30', 'competencia');
  assert.deepStrictEqual([m.lucroBruto, m.resultadoLiquido], [14100, 7000]);
});

test('fluxo de caixa: realizado, previsto, atraso e saldo', () => {
  const f = R.fluxoCaixa(base, '2026-09-01', '2026-10-31', 1000, '2026-10-26', false);
  assert.deepStrictEqual(f.linhas.map(l => [l.periodo, l.entradas, l.saidas, l.entradasPrev, l.saidasPrev, l.saldoFinal]), [
    ['2026-09', 10000, 5100, 0, 0, 5900],
    ['2026-10', 0, 4000, 5000, 900, 6000]]);
  assert.deepStrictEqual([f.atrasoReceber, f.atrasoPagar], [5000, 900]);
});

test('saldo numa data e balanço gerencial', () => {
  // saldo hoje 7000: em 30/09 era 7000 + 4000 (folha paga em 05/10) = 11000
  assert.strictEqual(R.saldoEm(base, 7000, '2026-09-30', '2026-10-26'), 11000);
  const b = R.balanco(base, 7000, '2026-09-30', '2026-10-26');
  assert.deepStrictEqual([b.disponivel, b.receberAVencer, b.pagarAVencer, b.pagarVencido, b.ativo, b.passivo, b.pl],
    [11000, 5000, 4900, 0, 16000, 4900, 11100]);
  assert.deepStrictEqual(R.variacao(120, 100), { valor: 20, pct: 20 });
});

test('despesas mês a mês por grupo e categoria', () => {
  const evs = [
    ev('a', 'pagar', 'Folha de pagamento', { competencia: '2026-08-30', total: 4000 }),
    ev('b', 'pagar', 'Folha de pagamento', { competencia: '2026-09-30', total: 4200 }),
    ev('c', 'pagar', 'Aluguel', { competencia: '2026-09-05', total: 1000 }),
    ev('d', 'pagar', 'Empréstimo capital de giro', { competencia: '2026-09-21', total: 2000 }),
    ev('e', 'receber', 'Vendas', { competencia: '2026-09-21', total: 9000 })
  ];
  const d = R.despesasMensais(evs, {}, '2026-08-01', '2026-09-30', 'competencia');
  assert.deepStrictEqual(d.meses, ['2026-08', '2026-09']);
  assert.deepStrictEqual(d.grupos.pessoal.porMes, [4000, 4200]);
  assert.deepStrictEqual(d.grupos.administrativas.categorias.Aluguel, [0, 1000]);
  assert.deepStrictEqual(d.totalPorMes, [4000, 5200]); // empréstimo (fora da DRE) não soma
  assert.deepStrictEqual(d.grupos.fora.porMes, [0, 2000]);
});
