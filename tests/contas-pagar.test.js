// node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const C = require('../contas-pagar/contas-pagar-core.js');

test('valores e datas no formato da planilha', () => {
  assert.strictEqual(C.valor('1.234,56'), 1234.56);
  assert.strictEqual(C.valor(27498.92), 27498.92);
  assert.strictEqual(C.valor(''), 0);
  assert.strictEqual(C.data('31/08/2026'), '2026-08-31');
  assert.strictEqual(C.data(new Date(2026, 9, 14)), '2026-10-14');
  assert.strictEqual(C.data('negociado'), '');
});

test('lerPlanilha: contas e quadro de bancos do escritório', () => {
  const linhas = [
    ['Nome do Credor', 'Vencimento', 'Observação', 'Descrição', 'Valor', 'PIX', null, 'SALDO', null, null, 'Banco', 'Conta', 'Limite (Especial)', 'Limite Especial  Utilizado', 'Limite Especial Disponível', 'Saldo Disponível (sem utilização de limite)'],
    ['LUMIAR', '28/09/2026', 'negociado', 'LOCAÇÃO', 35404.41, '05.652.247/0003-78', null, null, null, null, 'UNICRED', '5818-1', 300000, -295856.61, 3927.04, 0],
    ['Carlos Roberto', '16/10/2026', new Date(2026, 9, 23), 'PLANTÃO', 323, '(21) 98036-3770', 'NÃO TA LANÇADO', null, null, null, 'ITAÚ', '98925-7', 0, 0, 0, 4938.1],
    [null, null, null, null, null, null, null, null, null, null, null, null, '=SUM(M2:M3)', null, null, null]
  ];
  const r = C.lerPlanilha(linhas);
  assert.strictEqual(r.itens.length, 2);
  assert.deepStrictEqual(r.itens[1], { credor: 'Carlos Roberto', vencimento: '2026-10-16', descricao: 'PLANTÃO', valor: 323, pix: '(21) 98036-3770', obs: 'pagar em 23/10/2026', nota: 'NÃO TA LANÇADO' });
  assert.strictEqual(r.saldos.length, 2);
  assert.strictEqual(r.saldos[0].disponivel, 3927.04);
  const t = C.totais(r.itens.map(i => ({ ...i, pagar: true, valorPagar: i.valor })), r.saldos);
  assert.deepStrictEqual([t.pagar, t.semLimite, t.limiteDisp, t.sobraComLimite], [35727.41, 4938.1, 3927.04, -26862.27]);
});

test('alertas: protesto, vencido, duplicado e não lançado', () => {
  const a = { credor: 'CORPHO', vencimento: '2026-10-01', descricao: 'PEDIDO - PROTESTO EM 5 DIAS', valor: 610.44, obs: '' };
  const b = { credor: 'corpho', vencimento: '2026-10-23', descricao: 'outro', valor: 610.44, obs: '', origem: 'manual' };
  const txt = C.alertas(a, [a, b], '2026-10-23').map(x => x.txt);
  assert.deepStrictEqual(txt, ['protesto', 'vencido há 22 dia(s)', '2 contas iguais (mesmo credor e valor)']);
  assert.ok(C.alertas(b, [a, b], '2026-10-23').some(x => x.txt === 'não está no Conta Azul'));
});

test('juntar planilha com Conta Azul: mesma conta leva observação e PIX, 1 para 1', () => {
  const ca = [{ id: 'x', credor: 'Carlos Roberto de Oliveira Santos', vencimento: '2026-10-23', valor: 323, obs: '', pix: '' },
    { id: 'y', credor: 'Carlos Roberto de Oliveira Santos', vencimento: '2026-10-23', valor: 323, obs: '', pix: '' }];
  const man = [{ id: 'm1', credor: 'Carlos Roberto de Oliveira Santos', vencimento: '2026-10-20', valor: 323, obs: 'negociado', pix: '(21) 98036-3770', pagar: true, valorPagar: 323 },
    { id: 'm2', credor: 'ERICK CASTRO', vencimento: '2026-10-16', valor: 323, obs: '', pix: '21 9', pagar: true, valorPagar: 323 }];
  const r = C.juntar(ca, man);
  assert.strictEqual(r.juntadas, 1);
  assert.deepStrictEqual(r.itens.map(i => i.id), ['x', 'y', 'm2']);
  assert.strictEqual(r.itens[0].pix, '(21) 98036-3770');
  assert.ok(C.mesmoCredor('MERCADAO DA LIMPEZA LTDA', 'Mercadão da Limpeza'));
  assert.ok(!C.mesmoCredor('ERICK CASTRO', 'ANDERSON LUIZ'));
});

test('resumo e lista Pix só com as marcadas', () => {
  const itens = [{ credor: 'A', vencimento: '2026-10-23', descricao: 'd', valor: 10, valorPagar: 10, pagar: true, pix: 'a@b.com', obs: '' },
    { credor: 'B', vencimento: '2026-10-23', descricao: 'e', valor: 5, valorPagar: 5, pagar: false, pix: 'x', obs: '' }];
  const res = C.resumo(itens, [{ saldo: 4 }], '2026-10-23', 'Cliente');
  assert.match(res, /Total: \*R\$\s?10,00\* \(1 conta/);
  assert.match(res, /Falta: R\$\s?6,00/);
  assert.strictEqual(C.listaPix(itens, '2026-10-23').split('\n').length, 2);
});

test('fechar o dia: baixa as marcadas, reagenda as previstas até hoje e passa as manuais para o próximo dia útil', () => {
  const it = (id, o) => ({ id, origem: 'ca', credor: id, vencimento: '2026-10-23', valor: 10, valorPagar: 10, pagar: false, ...o });
  const itens = [it('pagar', { pagar: true }), it('naoMarcada'), it('futura', { previsao: '2026-10-28' }), it('jaBaixada', { pagar: true, baixa: { status: 'ok' } }),
    it('zero', { pagar: true, valorPagar: 0 }), { id: 'm1', origem: 'manual', credor: 'x', pagar: false, valorPagar: 5 }, { id: 'm2', origem: 'manual', credor: 'y', pagar: true, valorPagar: 5 }];
  const p = C.planoFechamento(itens, '2026-10-23'); // sexta-feira
  assert.deepStrictEqual(p.baixar.map(i => i.id), ['pagar']);
  assert.deepStrictEqual(p.reagendar.map(i => i.id), ['naoMarcada', 'zero']);
  assert.deepStrictEqual(p.manuaisAmanha.map(i => i.id), ['m1']);
  assert.deepStrictEqual(p.manuaisPagos.map(i => i.id), ['m2']);
  assert.strictEqual(p.amanha, '2026-10-26'); // segunda
});
