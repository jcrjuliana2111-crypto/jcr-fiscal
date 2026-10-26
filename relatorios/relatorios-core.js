// Regras dos relatórios financeiros (DRE, fluxo de caixa, balanço gerencial) a partir das
// parcelas do Conta Azul. Sem tela: usado pela página (window.Relatorios) e pelos testes.
//
// Evento (parcela): { id, tipo: 'receber'|'pagar', descricao, contato, categoria, vencimento,
//   competencia, dataPagamento, total, aberto, pago, status } — datas "aaaa-mm-dd".
(function (root) {
  const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
  const dt = s => s ? s.split('-').reverse().join('/') : '';
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const somarDias = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };
  const fimDoMes = (a, m) => iso(new Date(a, m, 0)); // m = 1..12
  const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const nomeMes = ym => `${MES[Number(ym.slice(5, 7)) - 1]}/${ym.slice(2, 4)}`;

  // ---------- períodos ----------
  function meses(de, ate) {
    const out = []; let a = Number(de.slice(0, 4)), m = Number(de.slice(5, 7));
    const fa = Number(ate.slice(0, 4)), fm = Number(ate.slice(5, 7));
    while (a < fa || (a === fa && m <= fm)) { out.push(`${a}-${String(m).padStart(2, '0')}`); if (++m > 12) { m = 1; a++; } }
    return out;
  }
  const mesInteiro = (de, ate) => de.slice(8) === '01' && ate === fimDoMes(Number(ate.slice(0, 4)), Number(ate.slice(5, 7)));
  // período imediatamente anterior, do mesmo tamanho (em meses, se forem meses inteiros)
  function periodoAnterior(de, ate) {
    if (mesInteiro(de, ate)) {
      const n = meses(de, ate).length;
      const d = new Date(Number(de.slice(0, 4)), Number(de.slice(5, 7)) - 1 - n, 1);
      const f = new Date(d.getFullYear(), d.getMonth() + n, 0);
      return { de: iso(d), ate: iso(f) };
    }
    const dias = Math.round((Date.parse(ate) - Date.parse(de)) / 864e5) + 1;
    return { de: somarDias(de, -dias), ate: somarDias(de, -1) };
  }
  function anoAnterior(de, ate) {
    const menos = s => { const a = Number(s.slice(0, 4)) - 1, m = Number(s.slice(5, 7)), d = Number(s.slice(8)); return iso(new Date(a, m - 1, Math.min(d, new Date(a, m, 0).getDate()))); };
    return { de: menos(de), ate: menos(ate) };
  }
  function presetPeriodo(tipo, hoje) {
    const a = Number(hoje.slice(0, 4)), m = Number(hoje.slice(5, 7));
    switch (tipo) {
      case 'mes': return { de: `${hoje.slice(0, 7)}-01`, ate: fimDoMes(a, m) };
      case 'mesAnterior': { const d = new Date(a, m - 2, 1); return { de: iso(d), ate: fimDoMes(d.getFullYear(), d.getMonth() + 1) }; }
      case 'trimestre': { const t = Math.floor((m - 1) / 3) * 3; return { de: iso(new Date(a, t, 1)), ate: fimDoMes(a, t + 3) }; }
      case 'ano': return { de: `${a}-01-01`, ate: `${a}-12-31` };
      case '12meses': { const d = new Date(a, m - 12, 1); return { de: iso(d), ate: fimDoMes(a, m) }; }
    }
    return null;
  }

  // ---------- DRE ----------
  // grupos da DRE (despesas guardadas positivas; o sinal entra na conta)
  const GRUPOS = [
    { id: 'receita', nome: 'Receita bruta', tipo: 'receber' },
    { id: 'deducoes', nome: '(−) Deduções e impostos sobre vendas', tipo: 'pagar' },
    { id: 'custos', nome: '(−) Custos (CMV / CSP)', tipo: 'pagar' },
    { id: 'pessoal', nome: '(−) Despesas com pessoal', tipo: 'pagar' },
    { id: 'administrativas', nome: '(−) Despesas administrativas', tipo: 'pagar' },
    { id: 'comerciais', nome: '(−) Despesas comerciais', tipo: 'pagar' },
    { id: 'recFinanceiras', nome: '(+) Receitas financeiras', tipo: 'receber' },
    { id: 'despFinanceiras', nome: '(−) Despesas financeiras', tipo: 'pagar' },
    { id: 'outrasRec', nome: '(+) Outras receitas', tipo: 'receber' },
    { id: 'outrasDesp', nome: '(−) Outras despesas', tipo: 'pagar' },
    { id: 'impostosLucro', nome: '(−) IRPJ / CSLL', tipo: 'pagar' },
    { id: 'fora', nome: 'Fora da DRE (empréstimos, transferências, aportes, distribuição de lucros)', tipo: '' }
  ];
  // palpite do grupo pela categoria (a pessoa ajusta no "Mapa de categorias")
  function palpiteGrupo(categoria, tipo) {
    const c = norm(categoria);
    const tem = (...p) => p.some(x => c.includes(x));
    if (tipo === 'receber' && tem('rendimento', 'juros recebidos')) return 'recFinanceiras';
    if (tem('transferencia', 'emprestimo', 'financiamento', 'aporte', 'distribuicao', 'lucros distribu', 'aplicacao', 'resgate', 'socio', 'capital de giro', 'consorcio', 'investimento')) return 'fora';
    if (tipo === 'receber') {
      if (tem('rendimento', 'juros', 'financeir', 'desconto obtido')) return 'recFinanceiras';
      if (tem('outras receitas', 'reembolso', 'venda de ativo', 'nao operacional')) return 'outrasRec';
      return 'receita';
    }
    if (tem('irpj', 'csll', 'imposto de renda', 'contribuicao social')) return 'impostosLucro';
    if (tem('simples', 'das ', 'iss', 'pis', 'cofins', 'icms', 'imposto sobre', 'deducao', 'devoluc', 'impostos sobre')) return 'deducoes';
    if (tem('tarifa', 'juros', 'iof', 'multa', 'despesa bancaria', 'despesas bancarias', 'financeir', 'cartao de credito taxa')) return 'despFinanceiras';
    if (tem('salario', 'folha', 'pro-labore', 'pro labore', 'prolabore', 'inss', 'fgts', 'ferias', '13', 'rescis', 'vale', 'beneficio', 'plano de saude', 'equipe', 'plantao', 'plantonista', 'pessoal', 'funcionario', 'estagi', 'seguro de vida')) return 'pessoal';
    if (tem('custo', 'mercadoria', 'material', 'medicamento', 'insumo', 'compra', 'materia', 'locacao de equipamento', 'servicos medicos', 'terceirizad', 'cmv', 'csp')) return 'custos';
    if (tem('marketing', 'publicidade', 'propaganda', 'comiss', 'comercial', 'brinde', 'evento')) return 'comerciais';
    if (tem('outras despesas', 'nao operacional', 'perda')) return 'outrasDesp';
    return 'administrativas';
  }
  const grupoDe = (ev, mapa) => (mapa && mapa[chaveCat(ev)]) || palpiteGrupo(ev.categoria, ev.tipo);
  const chaveCat = ev => `${ev.tipo}|${ev.categoria || '(sem categoria)'}`;

  // valor e data do evento na DRE: competência (valor total na data de competência) ou caixa (pago na data do pagamento)
  function naDRE(ev, regime) {
    if (regime === 'caixa') return ev.pago > 0 ? { data: ev.dataPagamento || ev.vencimento, valor: ev.pago } : null;
    return { data: ev.competencia || ev.vencimento, valor: ev.total };
  }
  function montarDRE(eventos, mapa, de, ate, regime) {
    const g = Object.fromEntries(GRUPOS.map(x => [x.id, { total: 0, categorias: {} }]));
    for (const ev of eventos) {
      const v = naDRE(ev, regime);
      if (!v || !v.data || v.data < de || v.data > ate || !v.valor) continue;
      const id = grupoDe(ev, mapa), cat = ev.categoria || '(sem categoria)';
      g[id].total = r2(g[id].total + v.valor);
      g[id].categorias[cat] = r2((g[id].categorias[cat] || 0) + v.valor);
    }
    const t = id => g[id].total;
    const receitaLiquida = r2(t('receita') - t('deducoes'));
    const lucroBruto = r2(receitaLiquida - t('custos'));
    const despesasOperacionais = r2(t('pessoal') + t('administrativas') + t('comerciais'));
    const resultadoOperacional = r2(lucroBruto - despesasOperacionais);
    const resultadoFinanceiro = r2(t('recFinanceiras') - t('despFinanceiras'));
    const outras = r2(t('outrasRec') - t('outrasDesp'));
    const antesIR = r2(resultadoOperacional + resultadoFinanceiro + outras);
    const resultadoLiquido = r2(antesIR - t('impostosLucro'));
    return { grupos: g, receitaBruta: t('receita'), receitaLiquida, lucroBruto, despesasOperacionais, resultadoOperacional,
      resultadoFinanceiro, outras, antesIR, resultadoLiquido };
  }
  // linhas da DRE na ordem de exibição: {id, nome, campo|grupo, total?, nivel}
  const LINHAS_DRE = [
    { grupo: 'receita' }, { grupo: 'deducoes' }, { total: 'receitaLiquida', nome: '= Receita líquida' },
    { grupo: 'custos' }, { total: 'lucroBruto', nome: '= Lucro bruto' },
    { grupo: 'pessoal' }, { grupo: 'administrativas' }, { grupo: 'comerciais' },
    { total: 'resultadoOperacional', nome: '= Resultado operacional' },
    { grupo: 'recFinanceiras' }, { grupo: 'despFinanceiras' }, { grupo: 'outrasRec' }, { grupo: 'outrasDesp' },
    { total: 'antesIR', nome: '= Resultado antes do IR/CSLL' }, { grupo: 'impostosLucro' },
    { total: 'resultadoLiquido', nome: '= Resultado líquido' }
  ];
  function dreMensal(eventos, mapa, de, ate, regime) {
    return meses(de, ate).map(ym => {
      const a = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
      const ini = ym + '-01' < de ? de : ym + '-01', fim = fimDoMes(a, m) > ate ? ate : fimDoMes(a, m);
      const d = montarDRE(eventos, mapa, ini, fim, regime);
      return { mes: ym, rotulo: nomeMes(ym), receitaLiquida: d.receitaLiquida, despesas: r2(d.receitaLiquida - d.resultadoLiquido), resultado: d.resultadoLiquido };
    });
  }

  // ---------- fluxo de caixa ----------
  // realizado = pago na data do pagamento; previsto = em aberto no vencimento (vencidos em aberto vão para "hoje")
  function fluxoCaixa(eventos, de, ate, saldoInicial, hoje, porDia) {
    const chave = d => porDia ? d : d.slice(0, 7);
    const baldes = porDia ? (() => { const out = []; for (let d = de; d <= ate; d = somarDias(d, 1)) out.push(d); return out; })() : meses(de, ate);
    const linhas = Object.fromEntries(baldes.map(b => [b, { periodo: b, rotulo: porDia ? dt(b).slice(0, 5) : nomeMes(b), entradas: 0, saidas: 0, entradasPrev: 0, saidasPrev: 0 }]));
    let atrasoReceber = 0, atrasoPagar = 0;
    for (const ev of eventos) {
      const ent = ev.tipo === 'receber';
      if (ev.pago > 0) {
        const d = ev.dataPagamento || ev.vencimento;
        if (d >= de && d <= ate && linhas[chave(d)]) linhas[chave(d)][ent ? 'entradas' : 'saidas'] += ev.pago;
      }
      if (ev.aberto > 0 && ev.vencimento) {
        let d = ev.vencimento;
        if (d < hoje) { if (ent) atrasoReceber += ev.aberto; else atrasoPagar += ev.aberto; d = hoje; }
        if (d >= de && d <= ate && linhas[chave(d)]) linhas[chave(d)][ent ? 'entradasPrev' : 'saidasPrev'] += ev.aberto;
      }
    }
    let saldo = r2(saldoInicial);
    const out = baldes.map(b => {
      const l = linhas[b];
      for (const k of ['entradas', 'saidas', 'entradasPrev', 'saidasPrev']) l[k] = r2(l[k]);
      l.saldoInicial = saldo;
      saldo = r2(saldo + l.entradas - l.saidas + l.entradasPrev - l.saidasPrev);
      l.saldoFinal = saldo;
      return l;
    });
    const soma = k => r2(out.reduce((t, l) => t + l[k], 0));
    return { linhas: out, entradas: soma('entradas'), saidas: soma('saidas'), entradasPrev: soma('entradasPrev'), saidasPrev: soma('saidasPrev'),
      saldoInicial: r2(saldoInicial), saldoFinal: saldo, atrasoReceber: r2(atrasoReceber), atrasoPagar: r2(atrasoPagar) };
  }
  // saldo das contas numa data, voltando do saldo de hoje pelos pagamentos feitos depois dela
  function saldoEm(eventos, saldoAtual, data, hoje) {
    let s = Number(saldoAtual) || 0;
    for (const ev of eventos) {
      if (!(ev.pago > 0)) continue;
      const d = ev.dataPagamento || ev.vencimento;
      if (d > data && d <= hoje) s += ev.tipo === 'receber' ? -ev.pago : ev.pago;
    }
    return r2(s);
  }

  // ---------- balanço gerencial ----------
  // na data: disponível (bancos) + a receber em aberto | a pagar em aberto | PL gerencial = diferença
  function balanco(eventos, saldoAtual, data, hoje) {
    const b = { data, disponivel: saldoEm(eventos, saldoAtual, data, hoje), receberAVencer: 0, receberVencido: 0, pagarAVencer: 0, pagarVencido: 0 };
    for (const ev of eventos) {
      const reconhecido = ev.competencia || ev.vencimento;
      if (!reconhecido || reconhecido > data) continue;
      const pagoAte = ev.pago > 0 && (ev.dataPagamento || ev.vencimento) <= data ? ev.pago : 0;
      const aberto = r2(ev.total - pagoAte);
      if (aberto <= 0.005) continue;
      const vencido = ev.vencimento && ev.vencimento < data;
      const k = (ev.tipo === 'receber' ? 'receber' : 'pagar') + (vencido ? 'Vencido' : 'AVencer');
      b[k] += aberto;
    }
    for (const k of ['receberAVencer', 'receberVencido', 'pagarAVencer', 'pagarVencido']) b[k] = r2(b[k]);
    b.ativo = r2(b.disponivel + b.receberAVencer + b.receberVencido);
    b.passivo = r2(b.pagarAVencer + b.pagarVencido);
    b.pl = r2(b.ativo - b.passivo);
    b.liquidezCorrente = b.passivo ? r2(b.ativo / b.passivo) : null;
    return b;
  }

  const variacao = (a, b) => ({ valor: r2(a - b), pct: b ? r2((a - b) / Math.abs(b) * 100) : null });

  const api = { norm, dt, meses, nomeMes, periodoAnterior, anoAnterior, presetPeriodo, GRUPOS, LINHAS_DRE, palpiteGrupo, grupoDe, chaveCat,
    naDRE, montarDRE, dreMensal, fluxoCaixa, saldoEm, balanco, variacao, somarDias };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Relatorios = api;
})(this);
