/*
 * Financeiro JCR — regras de cálculo (sem acesso a banco nem à tela).
 * Só o financeiro do próprio escritório: honorários da JCR (Gestão Fiscal) + lançamentos
 * de fin_lancamentos. Não usa Conta Azul.
 *
 * Datas como texto 'AAAA-MM-DD' e competências como 'AAAA-MM'.
 *
 * Movimento (forma comum usada no fluxo e na DRE):
 *   { tipo: 'pagar'|'receber', valor, valor_pago, status: 'aberto'|'pago'|'cancelado',
 *     competencia, vencimento, data_pagamento, grupo_dre, categoria }
 */
(function (root) {
  const pad = n => String(n).padStart(2, '0');

  // Linhas da DRE, na ordem em que aparecem
  const GRUPOS = {
    receita:            { nome: 'Receita de serviços',      sinal: +1 },
    deducao:            { nome: 'Impostos sobre o faturamento', sinal: -1 },
    custo:              { nome: 'Custos dos serviços',      sinal: -1 },
    pessoal:            { nome: 'Despesas com pessoal',     sinal: -1 },
    administrativa:     { nome: 'Despesas administrativas', sinal: -1 },
    comercial:          { nome: 'Despesas comerciais',      sinal: -1 },
    financeira_receita: { nome: 'Receitas financeiras',     sinal: +1 },
    financeira_despesa: { nome: 'Despesas financeiras',     sinal: -1 },
    ir:                 { nome: 'IRPJ e CSLL',              sinal: -1 },
    fora_dre:           { nome: 'Fora da DRE (investimentos, lucros distribuídos)', sinal: -1 },
  };

  function addMeses(comp, n) {
    const [a, m] = comp.split('-').map(Number);
    const t = a * 12 + (m - 1) + n;
    return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`;
  }
  function ultimoDia(ano, mes) { return new Date(Date.UTC(ano, mes, 0)).getUTCDate(); }
  // Mesmo dia em outro mês (31 vira o último dia do mês quando ele for menor)
  function mesmoDia(data, n) {
    const comp = addMeses(data.slice(0, 7), n);
    const [a, m] = comp.split('-').map(Number);
    return `${comp}-${pad(Math.min(+data.slice(8, 10), ultimoDia(a, m)))}`;
  }

  // Repete um lançamento por N meses (aluguel, sistemas…). parcelas=true → descreve como 1/N, 2/N…
  function repetir(base, vezes, parcelas) {
    const n = Math.max(1, Math.min(120, +vezes || 1));
    return [...Array(n)].map((_, i) => ({
      ...base,
      vencimento: mesmoDia(base.vencimento, i),
      competencia: addMeses(base.competencia, i),
      parcela: n > 1 && parcelas ? `${i + 1}/${n}` : (base.parcela || null),
    }));
  }

  function situacao(l, hoje) {
    if (l.status === 'cancelado') return 'cancelado';
    if (l.status === 'pago') return 'pago';
    if (l.vencimento < hoje) return 'vencida';
    if (l.vencimento === hoje) return 'hoje';
    return 'aberto';
  }

  const valorMov = m => +(m.status === 'pago' && m.valor_pago != null ? m.valor_pago : m.valor) || 0;

  // Honorário do Gestão Fiscal → movimento. O Gestão Fiscal não guarda a data do recebimento:
  // honorário pago entra no caixa na data de vencimento.
  function deHonorario(h) {
    const st = String(h.status || '').toLowerCase();
    const status = st === 'pago' || st === 'recebido' ? 'pago' : st === 'cancelado' ? 'cancelado' : 'aberto';
    return {
      origem: 'honorario', id: h.id, tipo: 'receber', grupo_dre: 'receita', categoria: 'Honorários',
      descricao: [h.servico || h.tipo || 'Honorário', h.nome_cliente].filter(Boolean).join(' — '),
      valor: +h.valor || 0, valor_pago: null, status,
      vencimento: h.vencimento, competencia: h.competencia || (h.vencimento || '').slice(0, 7),
      data_pagamento: status === 'pago' ? h.vencimento : null,
    };
  }

  // Fluxo de caixa mês a mês do ano.
  //  Realizado: pagos, pelo mês do pagamento. Previsto: em aberto, pelo vencimento;
  //  o que já venceu e não foi pago entra como previsto no mês de hoje.
  //  Saldo: saldo inicial das contas + realizado a partir da data do saldo.
  function fluxoMensal({ movimentos, ano, saldoInicial = 0, dataSaldo = '0000-00-00', hoje }) {
    const mesHoje = hoje.slice(0, 7);
    const meses = [...Array(12)].map((_, i) => ({
      mes: `${ano}-${pad(i + 1)}`, entradas: 0, saidas: 0, prevEntradas: 0, prevSaidas: 0, saidasPorGrupo: {},
    }));
    let saldoAntes = +saldoInicial || 0;
    for (const m of movimentos) {
      if (m.status === 'cancelado') continue;
      const v = valorMov(m), entra = m.tipo === 'receber';
      if (m.status === 'pago') {
        const d = m.data_pagamento || m.vencimento;
        if (!d || d < dataSaldo) continue;
        if (d.slice(0, 4) < String(ano)) { saldoAntes += entra ? v : -v; continue; }
        const x = meses.find(z => z.mes === d.slice(0, 7));
        if (!x) continue;
        if (entra) x.entradas += v;
        else { x.saidas += v; x.saidasPorGrupo[m.grupo_dre || 'administrativa'] = (x.saidasPorGrupo[m.grupo_dre || 'administrativa'] || 0) + v; }
      } else {
        const mes = m.vencimento < hoje ? mesHoje : m.vencimento.slice(0, 7);
        const x = meses.find(z => z.mes === mes);
        if (!x) continue;
        if (entra) x.prevEntradas += v; else x.prevSaidas += v;
      }
    }
    // Realizado acumula só o que foi pago; projetado soma também o previsto a partir do mês de hoje.
    let real = saldoAntes, proj = saldoAntes;
    for (const x of meses) {
      const liquido = x.entradas - x.saidas;
      x.saldoInicial = real;
      real += liquido;
      x.saldoFinal = real;
      proj = x.mes < mesHoje ? real : proj + liquido + x.prevEntradas - x.prevSaidas;
      x.saldoProjetado = proj;
      x.antesDoSaldo = x.mes < dataSaldo.slice(0, 7); // sem saldo conhecido neste mês
    }
    return meses;
  }

  // DRE do ano. regime 'competencia' (mês da competência, inclui em aberto) ou 'caixa' (só pagos, mês do pagamento).
  function dre({ movimentos, ano, regime = 'competencia' }) {
    const zero = () => Array(12).fill(0);
    const grupos = {}, categorias = {};
    Object.keys(GRUPOS).forEach(g => { grupos[g] = zero(); categorias[g] = {}; });
    for (const m of movimentos) {
      if (m.status === 'cancelado') continue;
      if (regime === 'caixa' && m.status !== 'pago') continue;
      const ref = regime === 'caixa' ? (m.data_pagamento || m.vencimento || '') : (m.competencia || '');
      if (ref.slice(0, 4) !== String(ano)) continue;
      const i = +ref.slice(5, 7) - 1;
      const g = GRUPOS[m.grupo_dre] ? m.grupo_dre : (m.tipo === 'receber' ? 'receita' : 'administrativa');
      const v = regime === 'caixa' ? valorMov(m) : (+m.valor || 0);
      grupos[g][i] += v;
      const c = m.categoria || 'Sem categoria';
      (categorias[g][c] = categorias[g][c] || zero())[i] += v;
    }
    const soma = (...ls) => zero().map((_, i) => ls.reduce((a, [sinal, g]) => a + sinal * grupos[g][i], 0));
    const linhas = {
      receitaBruta: soma([1, 'receita']),
      receitaLiquida: soma([1, 'receita'], [-1, 'deducao']),
      lucroBruto: soma([1, 'receita'], [-1, 'deducao'], [-1, 'custo']),
      resultadoOperacional: soma([1, 'receita'], [-1, 'deducao'], [-1, 'custo'], [-1, 'pessoal'], [-1, 'administrativa'], [-1, 'comercial']),
      resultadoFinanceiro: soma([1, 'financeira_receita'], [-1, 'financeira_despesa']),
    };
    linhas.resultadoAntesIR = linhas.resultadoOperacional.map((v, i) => v + linhas.resultadoFinanceiro[i]);
    linhas.lucroLiquido = linhas.resultadoAntesIR.map((v, i) => v - grupos.ir[i]);
    linhas.margem = linhas.lucroLiquido.map((v, i) => linhas.receitaBruta[i] ? v / linhas.receitaBruta[i] : null);
    return { grupos, categorias, linhas };
  }

  const total = arr => arr.reduce((a, b) => a + (b || 0), 0);
  function fmtData(s) { return s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—'; }
  function fmtComp(c) { return c ? `${c.slice(5, 7)}/${c.slice(0, 4)}` : ''; }

  const api = { GRUPOS, addMeses, mesmoDia, repetir, situacao, deHonorario, fluxoMensal, dre, total, fmtData, fmtComp };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Financeiro = api;
})(this);
