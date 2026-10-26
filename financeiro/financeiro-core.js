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

  // Honorário do Gestão Fiscal → movimento. Pago entra no caixa na data do recebimento
  // (data_pagamento, gravada pelo Financeiro JCR); se foi marcado como pago no Gestão Fiscal, no vencimento.
  function deHonorario(h) {
    const st = String(h.status || '').toLowerCase();
    const status = st === 'pago' || st === 'recebido' ? 'pago' : st === 'cancelado' ? 'cancelado' : 'aberto';
    return {
      origem: 'honorario', id: h.id, tipo: 'receber', grupo_dre: 'receita', categoria: 'Honorários',
      descricao: [h.servico || h.tipo || 'Honorário', h.nome_cliente].filter(Boolean).join(' — '),
      valor: +h.valor || 0, valor_pago: null, status,
      vencimento: h.vencimento, competencia: h.competencia || (h.vencimento || '').slice(0, 7),
      data_pagamento: status === 'pago' ? (h.data_pagamento || h.vencimento) : null,
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

  // ── Recorrência: mudar o vencimento das próximas ──
  // A conta editada foi de 'antigo' para 'novo'. Cada próxima anda o mesmo número de meses
  // e passa a vencer no novo dia (31 vira o último dia em meses menores).
  function moverVencimento(antigo, novo, proxima) {
    const meses = (+novo.slice(0, 4) * 12 + +novo.slice(5, 7)) - (+antigo.slice(0, 4) * 12 + +antigo.slice(5, 7));
    const comp = addMeses(proxima.slice(0, 7), meses);
    const [a, m] = comp.split('-').map(Number);
    return `${comp}-${pad(Math.min(+novo.slice(8, 10), ultimoDia(a, m)))}`;
  }

  // ── Extrato bancário (OFX/CSV) ──
  function parseValor(s) {
    if (typeof s === 'number') return s;
    s = String(s || '').trim().replace(/[R$\s]/g, '');
    if (!s) return NaN;
    const neg = /^\(.*\)$/.test(s) || /^-/.test(s) || /-$/.test(s) || /D$/i.test(s);
    s = s.replace(/[()+-]/g, '').replace(/[CD]$/i, '');
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    const v = parseFloat(s);
    return neg ? -Math.abs(v) : v;
  }
  function parseData(s) {
    s = String(s || '').trim();
    let m = s.match(/^(\d{4})-?(\d{2})-?(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${pad(m[2])}-${pad(m[1])}`;
    return '';
  }
  function parseOFX(texto) {
    const t = String(texto);
    const movs = t.split(/<STMTTRN>/i).slice(1).map((b, i) => {
      const tag = n => { const m = b.match(new RegExp('<' + n + '>([^<\\r\\n]*)', 'i')); return m ? m[1].trim() : ''; };
      return { fitid: tag('FITID'), data: parseData(tag('DTPOSTED')), valor: parseValor(tag('TRNAMT').replace(',', '.')),
        historico: [tag('NAME'), tag('MEMO')].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim(), ordem: i };
    }).filter(m => m.data && !isNaN(m.valor) && m.valor !== 0);
    const led = t.match(/<LEDGERBAL>[\s\S]*?<BALAMT>([^<\r\n]+)[\s\S]*?<DTASOF>([^<\r\n]+)/i);
    return { movs, saldoFinal: led ? parseValor(led[1].replace(',', '.')) : null, dataSaldoFinal: led ? parseData(led[2]) : null };
  }
  function splitCSV(linha, sep) {
    const cols = []; let cur = '', q = false;
    for (let i = 0; i < linha.length; i++) {
      const c = linha[i];
      if (c === '"') { if (q && linha[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (c === sep && !q) { cols.push(cur); cur = ''; } else cur += c;
    }
    return cols.concat(cur).map(x => x.trim());
  }
  // CSV com cabeçalho: data + valor (ou crédito/débito). O histórico junta as colunas de texto
  // (descrição, transação, identificação, nome…), porque cada banco usa nomes diferentes.
  function parseCSV(texto) {
    const linhas = String(texto).replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
    if (!linhas.length) return { movs: [], saldoFinal: null, dataSaldoFinal: null };
    const sep = (linhas[0].match(/;/g) || []).length >= (linhas[0].match(/,/g) || []).length ? ';' : ',';
    const head = splitCSV(linhas[0], sep).map(h => h.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase());
    const idx = re => head.findIndex(h => re.test(h));
    const iData = idx(/data/), iValor = idx(/^valor|valor$|^montante|^quantia/), iCred = idx(/credito|entrada/), iDeb = idx(/debito|saida/);
    const iSaldo = idx(/saldo/);
    if (iData < 0 || (iValor < 0 && iCred < 0 && iDeb < 0)) throw new Error('O CSV precisa ter as colunas "Data" e "Valor" (ou "Crédito" e "Débito").');
    const texto_ = head.map((h, i) => i).filter(i => ![iData, iValor, iCred, iDeb, iSaldo].includes(i));
    const movs = [];
    for (let n = 1; n < linhas.length; n++) {
      const c = splitCSV(linhas[n], sep), data = parseData(c[iData]);
      let valor;
      if (iValor >= 0) valor = parseValor(c[iValor]);
      else { const cr = parseValor(c[iCred]), db = parseValor(c[iDeb]); valor = !isNaN(cr) && cr ? Math.abs(cr) : -Math.abs(db); }
      if (!data || isNaN(valor) || valor === 0) continue;
      movs.push({ fitid: '', data, valor, historico: texto_.map(i => c[i]).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim(), ordem: n });
    }
    return { movs, saldoFinal: null, dataSaldoFinal: null };
  }
  function parseExtrato(nome, texto) {
    return /\.ofx$/i.test(nome) || /<OFX>|<STMTTRN>/i.test(texto) ? parseOFX(texto) : parseCSV(texto);
  }
  // Chave única do movimento numa conta (para não importar duas vezes)
  function chaveMov(contaId, m) {
    return `${contaId}|${m.fitid || `${m.data}|${m.valor.toFixed(2)}|${semAcentos(m.historico).slice(0, 60)}`}`;
  }
  // Saldo no começo do primeiro dia do extrato, a partir do saldo final informado pelo banco
  function saldoAntes(movs, saldoFinal, dataSaldoFinal) {
    if (saldoFinal == null || !movs.length) return null;
    const ate = dataSaldoFinal || '9999-12-31';
    const soma = movs.filter(m => m.data <= ate).reduce((a, m) => a + m.valor, 0);
    return { valor: Math.round((saldoFinal - soma) * 100) / 100, data: movs.map(m => m.data).sort()[0] };
  }

  // ── Texto do extrato → regra de categoria e nome ──
  const semAcentos = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const RUIDO = new Set(['pix', 'ted', 'doc', 'tef', 'enviado', 'enviada', 'recebido', 'recebida', 'transferencia', 'transf', 'pagamento', 'pagto',
    'pgto', 'boleto', 'de', 'da', 'do', 'das', 'dos', 'para', 'p', 'a', 'o', 'e', 'em', 'compra', 'debito', 'credito', 'cartao', 'conta',
    'qr', 'code', 'cod', 'ltda', 'me', 'sa', 'eireli', 'epp', 'cpf', 'cnpj', 'saida', 'entrada', 'liquidacao', 'titulo', 'tit']);
  const palavras = s => semAcentos(s).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(t => t.length >= 2 && !RUIDO.has(t) && !/\d/.test(t));
  // "PIX ENVIADO 12/03 ENEL DISTRIBUICAO SP 123" → "enel distribuicao sp"
  function chaveRegra(historico) { return palavras(historico).slice(0, 3).join(' '); }
  // Fração das palavras do nome que aparecem no histórico
  function nomeNoHistorico(historico, nome) {
    const n = palavras(nome); if (!n.length) return 0;
    const h = new Set(palavras(historico));
    return n.filter(t => h.has(t)).length / n.length;
  }
  const diasEntre = (a, b) => Math.round(Math.abs(new Date(a + 'T00:00:00Z') - new Date(b + 'T00:00:00Z')) / 864e5);

  // Honorários em aberto que podem ser esta entrada: mesmo valor (ao centavo) e vencimento até 45 dias
  // de distância. Os melhores primeiro: nome do cliente no histórico, depois data mais próxima.
  function candidatosHonorario(mov, honorarios) {
    if (mov.valor <= 0) return [];
    return honorarios
      .filter(h => !['pago', 'recebido', 'cancelado'].includes(String(h.status || '').toLowerCase()))
      .filter(h => Math.abs((+h.valor || 0) - mov.valor) < 0.005 && h.vencimento && diasEntre(h.vencimento, mov.data) <= 45)
      .map(h => ({ h, nome: nomeNoHistorico(mov.historico, h.nome_cliente), dias: diasEntre(h.vencimento, mov.data) }))
      .sort((a, b) => (b.nome - a.nome) || (a.dias - b.dias))
      .map(x => x.h);
  }
  // Contas a pagar em aberto que podem ser esta saída: mesmo valor e vencimento até 15 dias
  function candidatosConta(mov, lancamentos) {
    if (mov.valor >= 0) return [];
    return lancamentos
      .filter(l => l.tipo === 'pagar' && l.status === 'aberto' && Math.abs(+l.valor + mov.valor) < 0.005 && diasEntre(l.vencimento, mov.data) <= 15)
      .sort((a, b) => diasEntre(a.vencimento, mov.data) - diasEntre(b.vencimento, mov.data));
  }

  const total = arr => arr.reduce((a, b) => a + (b || 0), 0);
  function fmtData(s) { return s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—'; }
  function fmtComp(c) { return c ? `${c.slice(5, 7)}/${c.slice(0, 4)}` : ''; }

  const api = { GRUPOS, addMeses, mesmoDia, repetir, situacao, deHonorario, fluxoMensal, dre, total, fmtData, fmtComp,
    moverVencimento, parseValor, parseData, parseOFX, parseCSV, parseExtrato, chaveMov, saldoAntes, chaveRegra,
    nomeNoHistorico, candidatosHonorario, candidatosConta };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Financeiro = api;
})(this);
