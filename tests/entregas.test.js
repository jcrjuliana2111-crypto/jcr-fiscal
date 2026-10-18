// node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const E = require('../entregas/entregas-core.js');

test('páscoa e feriados móveis', () => {
  assert.strictEqual(E.pascoa(2026), '2026-04-05');
  assert.strictEqual(E.pascoa(2027), '2027-03-28');
  const f = E.feriadosNacionais(2026);
  assert.strictEqual(f['2026-02-16'], 'Carnaval');
  assert.strictEqual(f['2026-02-17'], 'Carnaval');
  assert.strictEqual(f['2026-04-03'], 'Sexta-feira Santa');
  assert.strictEqual(f['2026-06-04'], 'Corpus Christi');
  assert.strictEqual(f['2026-11-20'], 'Consciência Negra');
});

test('dias úteis', () => {
  assert.strictEqual(E.diaUtil('2026-10-17'), false); // sábado
  assert.strictEqual(E.diaUtil('2026-10-12'), false); // feriado
  assert.strictEqual(E.diaUtil('2026-10-13'), true);
  assert.strictEqual(E.diaUtil('2026-10-13', ['2026-10-13']), false); // feriado municipal cadastrado
  assert.strictEqual(E.somarUteis('2026-10-20', -2), '2026-10-16');
  assert.strictEqual(E.nEsimoUtil(2026, 11, 5), '2026-11-09'); // 2/11 é Finados
  assert.strictEqual(E.nEsimoUtil(2026, 10, 0), '2026-10-30'); // 31/10 é sábado
});

test('vencimento por competência', () => {
  const das = { recorrencia: 'mensal', dia_vencimento: 20, ajuste: 'prorroga', competencia_meses: 1 };
  assert.strictEqual(E.vencimento(das, '2026-09'), '2026-10-20');
  assert.strictEqual(E.vencimento(das, '2026-05'), '2026-06-22'); // 20/06 sábado → segunda
  const antecipa = { ...das, ajuste: 'antecipa' };
  assert.strictEqual(E.vencimento(antecipa, '2026-05'), '2026-06-19');
  const irpj = { recorrencia: 'trimestral', dia_vencimento: 0, competencia_meses: 1 };
  assert.strictEqual(E.vencimento(irpj, '2026-09'), '2026-10-30');
  const defis = { recorrencia: 'anual', dia_vencimento: 31, mes_vencimento: 3, ajuste: 'antecipa' };
  assert.strictEqual(E.vencimento(defis, '2025-12'), '2026-03-31');
  const folha = { recorrencia: 'mensal', tipo_dia: 'uteis', dia_vencimento: 5, competencia_meses: 1 };
  assert.strictEqual(E.vencimento(folha, '2026-10'), '2026-11-09');
  const fev = { recorrencia: 'mensal', dia_vencimento: 31, ajuste: 'mantem', competencia_meses: 1 };
  assert.strictEqual(E.vencimento(fev, '2027-01'), '2027-02-28');
});

test('recorrência e regime', () => {
  assert.strictEqual(E.geraNaCompetencia({ recorrencia: 'trimestral' }, '2026-09'), true);
  assert.strictEqual(E.geraNaCompetencia({ recorrencia: 'trimestral' }, '2026-08'), false);
  assert.strictEqual(E.geraNaCompetencia({ recorrencia: 'anual' }, '2026-12'), true);
  assert.strictEqual(E.geraNaCompetencia({ recorrencia: 'eventual' }, '2026-12'), false);
  assert.strictEqual(E.aplicaAoRegime({ regimes: [] }, 'Lucro Real'), true);
  assert.strictEqual(E.aplicaAoRegime({ regimes: ['Simples Nacional'] }, 'Lucro Real'), false);
});

test('planejarEntregas não duplica e respeita cliente inativo', () => {
  const obrigacoes = [
    { id: 'o1', nome: 'DAS', departamento: 'Fiscal', recorrencia: 'mensal', dia_vencimento: 20, ajuste: 'prorroga', meta_dias: 2 },
    { id: 'o2', nome: 'IRPJ', departamento: 'Contábil', recorrencia: 'trimestral', dia_vencimento: 0 },
  ];
  const clientes = [{ id: 'c1', regime: 'Simples Nacional', status: 'Ativo' }, { id: 'c2', status: 'Inativo' }];
  const vinculos = [
    { cliente_id: 'c1', obrigacao_id: 'o1' }, { cliente_id: 'c1', obrigacao_id: 'o2' }, { cliente_id: 'c2', obrigacao_id: 'o1' },
  ];
  const r = E.planejarEntregas({ comp: '2026-08', clientes, vinculos, obrigacoes, existentes: [], responsaveis: { c1: { Fiscal: 'Ana' } } });
  assert.strictEqual(r.length, 1);
  assert.deepStrictEqual(r[0], {
    cliente_id: 'c1', obrigacao_id: 'o1', nome: 'DAS', departamento: 'Fiscal', competencia: '2026-08',
    vencimento: '2026-09-21', meta: '2026-09-17', responsavel: 'Ana',
  });
  const r2 = E.planejarEntregas({ comp: '2026-08', clientes, vinculos, obrigacoes, existentes: ['c1|o1|2026-08'] });
  assert.strictEqual(r2.length, 0);
});

test('situação e indicadores', () => {
  const hoje = '2026-10-17';
  const lista = [
    { status: 'entregue', vencimento: '2026-10-20', entregue_em: '2026-10-15T14:00:00Z' },
    { status: 'entregue', vencimento: '2026-10-10', entregue_em: '2026-10-11T09:00:00Z' },
    { status: 'pendente', vencimento: '2026-10-15' },
    { status: 'pendente', vencimento: '2026-10-17' },
    { status: 'pendente', vencimento: '2026-10-20', meta: '2026-10-16' },
    { status: 'pendente', vencimento: '2026-10-30', meta: '2026-10-28' },
    { status: 'dispensada', vencimento: '2026-10-01' },
  ];
  assert.deepStrictEqual(lista.map(e => E.situacao(e, hoje)),
    ['entregue_prazo', 'entregue_atraso', 'atrasada', 'vence_hoje', 'meta_estourada', 'pendente', 'dispensada']);
  const i = E.indicadores(lista, hoje);
  assert.strictEqual(i.pontualidade, 50);
  assert.strictEqual(i.progresso, 33);
});

test('montarPassos de processo', () => {
  const p = E.montarPassos([{ titulo: 'Coletar documentos' }, { titulo: 'Viabilidade', prazo_dias: 3 }], '2026-10-16');
  assert.strictEqual(p[0].prazo, '2026-10-16');
  assert.strictEqual(p[1].prazo, '2026-10-21');
  assert.strictEqual(p[1].feito, false);
});
