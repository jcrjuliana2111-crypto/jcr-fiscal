// node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const F = require('../financeiro/financeiro-core.js');

const mov = o => ({ tipo: 'pagar', status: 'aberto', valor: 100, valor_pago: null, grupo_dre: 'administrativa', categoria: 'Aluguel', ...o });

test('repetição mensal mantém o dia e ajusta fim de mês', () => {
  const r = F.repetir({ descricao: 'Aluguel', vencimento: '2026-01-31', competencia: '2026-01', valor: 1500 }, 3, true);
  assert.deepStrictEqual(r.map(x => x.vencimento), ['2026-01-31', '2026-02-28', '2026-03-31']);
  assert.deepStrictEqual(r.map(x => x.competencia), ['2026-01', '2026-02', '2026-03']);
  assert.deepStrictEqual(r.map(x => x.parcela), ['1/3', '2/3', '3/3']);
  assert.strictEqual(F.repetir({ vencimento: '2026-12-10', competencia: '2026-12' }, 2)[1].vencimento, '2027-01-10');
  assert.strictEqual(F.repetir({ vencimento: '2026-12-10', competencia: '2026-12' }, 2)[1].parcela, null);
});

test('situação da conta', () => {
  assert.strictEqual(F.situacao(mov({ vencimento: '2026-10-01' }), '2026-10-26'), 'vencida');
  assert.strictEqual(F.situacao(mov({ vencimento: '2026-10-26' }), '2026-10-26'), 'hoje');
  assert.strictEqual(F.situacao(mov({ vencimento: '2026-11-01' }), '2026-10-26'), 'aberto');
  assert.strictEqual(F.situacao(mov({ vencimento: '2026-10-01', status: 'pago' }), '2026-10-26'), 'pago');
});

test('honorário vira receita; pago entra na data de vencimento', () => {
  const h = F.deHonorario({ id: 'h1', status: 'Pago', valor: '400', vencimento: '2026-05-10', competencia: '2026-04', servico: 'Mensalidade', nome_cliente: 'ACME' });
  assert.strictEqual(h.tipo, 'receber');
  assert.strictEqual(h.status, 'pago');
  assert.strictEqual(h.data_pagamento, '2026-05-10');
  assert.strictEqual(h.competencia, '2026-04');
  assert.strictEqual(h.descricao, 'Mensalidade — ACME');
  assert.strictEqual(F.deHonorario({ status: 'Pendente', valor: 1, vencimento: '2026-05-10' }).status, 'aberto');
  assert.strictEqual(F.deHonorario({ status: 'Pago', valor: 1, vencimento: '2026-05-10', data_pagamento: '2026-05-14' }).data_pagamento, '2026-05-14');
});

test('fluxo de caixa: realizado, previsto e saldo', () => {
  const movimentos = [
    mov({ tipo: 'receber', status: 'pago', valor: 1000, vencimento: '2026-09-10', data_pagamento: '2026-09-10', grupo_dre: 'receita' }),
    mov({ status: 'pago', valor: 300, valor_pago: 310, vencimento: '2026-09-05', data_pagamento: '2026-09-06' }),
    mov({ valor: 200, vencimento: '2026-10-01' }),                    // vencida e aberta → previsto em outubro (mês de hoje)
    mov({ valor: 150, vencimento: '2026-11-15' }),                    // previsto em novembro
    mov({ tipo: 'receber', valor: 500, vencimento: '2026-11-10' }),   // previsto em novembro
    mov({ status: 'cancelado', valor: 999, vencimento: '2026-10-05' }),
    mov({ tipo: 'receber', status: 'pago', valor: 50, vencimento: '2025-12-20', data_pagamento: '2025-12-20' }), // ano anterior
  ];
  const f = F.fluxoMensal({ movimentos, ano: 2026, saldoInicial: 100, dataSaldo: '2025-01-01', hoje: '2026-10-26' });
  const set = f[8], out = f[9], nov = f[10];
  assert.strictEqual(set.saldoInicial, 150);            // 100 + 50 do ano anterior
  assert.strictEqual(set.entradas, 1000);
  assert.strictEqual(set.saidas, 310);                  // usa o valor pago
  assert.strictEqual(set.saldoFinal, 840);
  assert.strictEqual(out.prevSaidas, 200);
  assert.strictEqual(out.saldoFinal, 840);
  assert.strictEqual(out.saldoProjetado, 640);
  assert.strictEqual(nov.prevEntradas, 500);
  assert.strictEqual(nov.prevSaidas, 150);
  assert.strictEqual(nov.saldoProjetado, 990);
  assert.strictEqual(f[11].saldoProjetado, 990);
  assert.strictEqual(set.saidasPorGrupo.administrativa, 310);
});

test('fluxo ignora o que foi pago antes da data do saldo inicial', () => {
  const movimentos = [mov({ status: 'pago', valor: 500, vencimento: '2026-01-05', data_pagamento: '2026-01-05' })];
  const f = F.fluxoMensal({ movimentos, ano: 2026, saldoInicial: 1000, dataSaldo: '2026-02-01', hoje: '2026-10-26' });
  assert.strictEqual(f[0].saidas, 0);
  assert.strictEqual(f[11].saldoFinal, 1000);
  assert.strictEqual(f[0].antesDoSaldo, true);
  assert.strictEqual(f[1].antesDoSaldo, false);
});

test('DRE por competência e por caixa', () => {
  const movimentos = [
    mov({ tipo: 'receber', grupo_dre: 'receita', categoria: 'Honorários', valor: 10000, competencia: '2026-09', vencimento: '2026-10-10' }),
    mov({ grupo_dre: 'deducao', categoria: 'DAS', valor: 600, competencia: '2026-09', vencimento: '2026-10-20' }),
    mov({ grupo_dre: 'custo', categoria: 'Terceiros', valor: 1000, competencia: '2026-09', vencimento: '2026-09-30', status: 'pago', data_pagamento: '2026-09-30' }),
    mov({ grupo_dre: 'pessoal', categoria: 'Pró-labore', valor: 3000, competencia: '2026-09', vencimento: '2026-10-05' }),
    mov({ grupo_dre: 'administrativa', categoria: 'Aluguel', valor: 1500, competencia: '2026-09', vencimento: '2026-09-10' }),
    mov({ grupo_dre: 'financeira_despesa', categoria: 'Tarifas', valor: 100, competencia: '2026-09', vencimento: '2026-09-30' }),
    mov({ grupo_dre: 'ir', categoria: 'IRPJ', valor: 400, competencia: '2026-09', vencimento: '2026-10-31' }),
    mov({ grupo_dre: 'fora_dre', categoria: 'Lucros', valor: 2000, competencia: '2026-09', vencimento: '2026-10-05' }),
    mov({ grupo_dre: 'administrativa', categoria: 'Aluguel', valor: 9999, competencia: '2026-09', vencimento: '2026-09-10', status: 'cancelado' }),
  ];
  const d = F.dre({ movimentos, ano: 2026 });
  const set = k => d.linhas[k][8];
  assert.strictEqual(set('receitaBruta'), 10000);
  assert.strictEqual(set('receitaLiquida'), 9400);
  assert.strictEqual(set('lucroBruto'), 8400);
  assert.strictEqual(set('resultadoOperacional'), 3900);
  assert.strictEqual(set('resultadoFinanceiro'), -100);
  assert.strictEqual(set('lucroLiquido'), 3400);         // fora_dre não entra
  assert.strictEqual(d.linhas.margem[8], 0.34);
  assert.strictEqual(d.categorias.administrativa.Aluguel[8], 1500);
  assert.strictEqual(d.linhas.margem[0], null);

  const caixa = F.dre({ movimentos, ano: 2026, regime: 'caixa' });
  assert.strictEqual(caixa.linhas.lucroBruto[8], -1000);  // só o custo foi pago em setembro
  assert.strictEqual(caixa.linhas.receitaBruta[9], 0);
});
