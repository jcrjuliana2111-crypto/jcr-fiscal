/*
 * JCR Entregas — regras de prazo (sem acesso a banco nem à tela).
 *
 * Datas sempre como texto 'AAAA-MM-DD' e competências como 'AAAA-MM',
 * para não sofrer com fuso horário.
 *
 * Obrigação (ent_obrigacoes):
 *   recorrencia        mensal | bimestral | trimestral | semestral | anual
 *   dia_vencimento     dia do mês (corridos) ou n-ésimo dia útil (uteis); 0 = último dia útil
 *   tipo_dia           corridos | uteis
 *   ajuste             antecipa | prorroga | mantem  (vencimento que cai em dia não útil)
 *   competencia_meses  quantos meses depois da competência vence (DAS: 1, DEFIS: n/a)
 *   mes_vencimento     só anual: mês do vencimento no ano seguinte ao ano-base
 *   meta_dias          meta interna: dias úteis antes do vencimento
 *   regimes            regimes em que se aplica (vazio = todos)
 */
(function (root) {
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d || 1)); };
  const addDias = (s, n) => { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
  const ultimoDia = (ano, mes) => new Date(Date.UTC(ano, mes, 0)).getUTCDate();

  // Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher)
  function pascoa(ano) {
    const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
    return `${ano}-${pad(mes)}-${pad(dia)}`;
  }

  // Feriados nacionais + dias sem expediente bancário (Carnaval e Corpus Christi).
  const cacheFeriados = {};
  function feriadosNacionais(ano) {
    if (cacheFeriados[ano]) return cacheFeriados[ano];
    const p = pascoa(ano);
    const lista = {
      [`${ano}-01-01`]: 'Confraternização Universal',
      [addDias(p, -48)]: 'Carnaval',
      [addDias(p, -47)]: 'Carnaval',
      [addDias(p, -2)]: 'Sexta-feira Santa',
      [`${ano}-04-21`]: 'Tiradentes',
      [`${ano}-05-01`]: 'Dia do Trabalho',
      [addDias(p, 60)]: 'Corpus Christi',
      [`${ano}-09-07`]: 'Independência',
      [`${ano}-10-12`]: 'Nossa Senhora Aparecida',
      [`${ano}-11-02`]: 'Finados',
      [`${ano}-11-15`]: 'Proclamação da República',
      [`${ano}-12-25`]: 'Natal',
    };
    if (ano >= 2024) lista[`${ano}-11-20`] = 'Consciência Negra';
    return (cacheFeriados[ano] = lista);
  }

  // extras: lista de datas 'AAAA-MM-DD' (feriados estaduais/municipais cadastrados)
  function diaUtil(s, extras) {
    const dow = parse(s).getUTCDay();
    if (dow === 0 || dow === 6) return false;
    if (feriadosNacionais(+s.slice(0, 4))[s]) return false;
    return !(extras && extras.includes(s));
  }
  function proximoUtil(s, extras) { while (!diaUtil(s, extras)) s = addDias(s, 1); return s; }
  function anteriorUtil(s, extras) { while (!diaUtil(s, extras)) s = addDias(s, -1); return s; }
  function somarUteis(s, n, extras) {
    const passo = n < 0 ? -1 : 1;
    for (let i = 0; i < Math.abs(n); i++) { s = addDias(s, passo); while (!diaUtil(s, extras)) s = addDias(s, passo); }
    return s;
  }
  function nEsimoUtil(ano, mes, n, extras) {
    if (!n) return anteriorUtil(`${ano}-${pad(mes)}-${pad(ultimoDia(ano, mes))}`, extras);
    let s = proximoUtil(`${ano}-${pad(mes)}-01`, extras);
    for (let i = 1; i < n; i++) s = somarUteis(s, 1, extras);
    return s;
  }

  function addMeses(comp, n) {
    const [y, m] = comp.split('-').map(Number);
    const t = y * 12 + (m - 1) + n;
    return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`;
  }

  // A competência gera entrega para esta obrigação?
  const MESES_DA_RECORRENCIA = {
    mensal: null, bimestral: [2, 4, 6, 8, 10, 12], trimestral: [3, 6, 9, 12], semestral: [6, 12], anual: [12],
  };
  function geraNaCompetencia(ob, comp) {
    if (!(ob.recorrencia in MESES_DA_RECORRENCIA)) return false;
    const meses = MESES_DA_RECORRENCIA[ob.recorrencia];
    return !meses || meses.includes(+comp.slice(5, 7));
  }

  function aplicaAoRegime(ob, regime) {
    return !ob.regimes || !ob.regimes.length || ob.regimes.includes(regime);
  }

  // Vencimento legal da obrigação para a competência.
  function vencimento(ob, comp, extras) {
    let mesVenc;
    if (ob.recorrencia === 'anual' && ob.mes_vencimento) mesVenc = `${+comp.slice(0, 4) + 1}-${pad(ob.mes_vencimento)}`;
    else mesVenc = addMeses(comp, ob.competencia_meses == null ? 1 : +ob.competencia_meses);
    const [ano, mes] = mesVenc.split('-').map(Number);
    const dia = +ob.dia_vencimento || 0;
    if (ob.tipo_dia === 'uteis' || dia === 0) return nEsimoUtil(ano, mes, dia, extras);
    const s = `${ano}-${pad(mes)}-${pad(Math.min(dia, ultimoDia(ano, mes)))}`;
    if (diaUtil(s, extras) || ob.ajuste === 'mantem') return s;
    return ob.ajuste === 'prorroga' ? proximoUtil(s, extras) : anteriorUtil(s, extras);
  }

  function meta(ob, venc, extras) {
    const n = +ob.meta_dias || 0;
    return n > 0 ? somarUteis(venc, -n, extras) : venc;
  }

  /*
   * Entregas a criar para uma competência.
   *  clientes:  [{ id, regime, status }]
   *  vinculos:  [{ cliente_id, obrigacao_id, responsavel }]  (obrigações de cada cliente)
   *  obrigacoes: catálogo
   *  existentes: chaves 'cliente|obrigacao|competencia' já geradas
   *  responsaveis: { cliente_id: { departamento: nome } }
   */
  function planejarEntregas({ comp, clientes, vinculos, obrigacoes, existentes, responsaveis, extras }) {
    const obPorId = new Map(obrigacoes.map(o => [o.id, o]));
    const cliPorId = new Map(clientes.map(c => [c.id, c]));
    const ja = new Set(existentes || []);
    const novas = [];
    for (const v of vinculos) {
      const ob = obPorId.get(v.obrigacao_id), cli = cliPorId.get(v.cliente_id);
      if (!ob || !cli || ob.ativo === false) continue;
      if (cli.status && cli.status !== 'Ativo') continue;
      if (!geraNaCompetencia(ob, comp)) continue;
      if (ja.has(`${cli.id}|${ob.id}|${comp}`)) continue;
      const venc = vencimento(ob, comp, extras);
      const dep = ob.departamento || 'Fiscal';
      novas.push({
        cliente_id: cli.id, obrigacao_id: ob.id, nome: ob.nome, departamento: dep, competencia: comp,
        vencimento: venc, meta: meta(ob, venc, extras),
        responsavel: v.responsavel || (responsaveis && responsaveis[cli.id] && responsaveis[cli.id][dep]) || null,
      });
    }
    return novas;
  }

  // Situação de uma entrega na data de hoje.
  function situacao(e, hoje) {
    if (e.status === 'dispensada') return 'dispensada';
    if (e.status === 'entregue') {
      const dia = (e.entregue_em || '').slice(0, 10);
      return dia && dia > e.vencimento ? 'entregue_atraso' : 'entregue_prazo';
    }
    if (e.vencimento < hoje) return 'atrasada';
    if (e.vencimento === hoje) return 'vence_hoje';
    if (e.meta && e.meta < hoje) return 'meta_estourada';
    return 'pendente';
  }

  function indicadores(entregas, hoje) {
    const r = { total: 0, entregue_prazo: 0, entregue_atraso: 0, atrasada: 0, vence_hoje: 0, meta_estourada: 0, pendente: 0, dispensada: 0 };
    for (const e of entregas) { r.total++; r[situacao(e, hoje)]++; }
    const entregues = r.entregue_prazo + r.entregue_atraso;
    const validas = r.total - r.dispensada;
    r.entregues = entregues;
    r.pontualidade = entregues ? Math.round((r.entregue_prazo / entregues) * 100) : null;
    r.progresso = validas ? Math.round((entregues / validas) * 100) : null;
    return r;
  }

  // Processo: datas de cada passo a partir do início (prazo_dias em dias úteis).
  function montarPassos(modeloPassos, inicio, extras) {
    return (modeloPassos || []).map(p => ({
      titulo: p.titulo, responsavel: p.responsavel || null,
      prazo: p.prazo_dias ? somarUteis(inicio, +p.prazo_dias, extras) : inicio, feito: false, feito_em: null,
    }));
  }

  function compAnterior(hoje) { return addMeses(hoje.slice(0, 7), -1); }
  function fmtComp(comp) { return comp ? `${comp.slice(5, 7)}/${comp.slice(0, 4)}` : ''; }
  function fmtData(s) { return s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—'; }

  const api = { pascoa, feriadosNacionais, diaUtil, proximoUtil, anteriorUtil, somarUteis, nEsimoUtil, addMeses, addDias,
    geraNaCompetencia, aplicaAoRegime, vencimento, meta, planejarEntregas, situacao, indicadores, montarPassos,
    compAnterior, fmtComp, fmtData };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Entregas = api;
})(this);
