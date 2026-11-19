/*
 * Reforma Tributária (EC 132/2023 e LC 214/2025) — regras de cálculo do simulador.
 * Funções puras (sem tela), testadas em tests/reforma.test.js.
 *
 * Cálculo do regime regular igual à calculadora oficial da Receita (tratamento "Regime Geral"):
 *   alíquota efetiva = alíquota × (1 − percentual de redução da cClassTrib)
 *   tributo = base de cálculo × alíquota efetiva   (IBS e CBS são "por fora": não entram na própria base)
 *
 * As alíquotas de referência de 2027 em diante ainda não foram fixadas pelo Senado:
 * o simulador usa estimativas que a pessoa pode trocar.
 */
(function (root) {
  // Estimativa (editável na tela). Total ≈ 26,5% (estimativa do Ministério da Fazenda na tramitação).
  const REFERENCIA_PADRAO = { cbs: 8.8, ibs_uf: 17.7, ibs_mun: 0, estimativa: true };
  // Em 2029–2032 o IBS sobe aos poucos e o ICMS/ISS cai na mesma proporção.
  const FRACAO_IBS = { 2029: 0.1, 2030: 0.2, 2031: 0.3, 2032: 0.4 };

  const ANOS = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033];

  // O que vale em cada ano da transição
  function regrasAno(ano) {
    if (ano <= 2026) return {
      ano, fase: 'Teste', legado: 1, pis_cofins: true, ipi: true, is: false,
      nota: 'CBS 0,9% e IBS 0,1% só destacados na nota (ano de teste). Quem cumpre as obrigações acessórias fica dispensado de recolher; o valor pode compensar PIS/COFINS.',
    };
    if (ano <= 2028) return {
      ano, fase: 'CBS cheia', legado: 1, pis_cofins: false, ipi: false, is: true,
      nota: 'PIS e COFINS extintos e substituídos pela CBS (alíquota de referência menos 0,1 ponto). IBS de 0,1% (0,05% estadual + 0,05% municipal). IPI zerado, exceto Zona Franca. Começa o Imposto Seletivo. ICMS e ISS seguem inteiros.',
    };
    if (ano <= 2032) {
      const f = FRACAO_IBS[ano];
      return {
        ano, fase: 'Transição IBS', legado: 1 - f, fracao_ibs: f, pis_cofins: false, ipi: false, is: true,
        nota: `IBS a ${Math.round(f * 100)}% da alíquota de referência; ICMS e ISS a ${Math.round((1 - f) * 100)}% das alíquotas atuais.`,
      };
    }
    return { ano, fase: 'Modelo final', legado: 0, pis_cofins: false, ipi: false, is: true, nota: 'ICMS e ISS extintos. IBS e CBS integrais.' };
  }

  // Alíquotas nominais do ano (antes das reduções da cClassTrib)
  function aliquotasAno(ano, ref) {
    const r = { ...REFERENCIA_PADRAO, ...(ref || {}) };
    const g = regrasAno(ano);
    if (ano <= 2026) return { cbs: 0.9, ibs_uf: 0.1, ibs_mun: 0, regras: g };
    if (ano <= 2028) return { cbs: arred(r.cbs - 0.1, 4), ibs_uf: 0.05, ibs_mun: 0.05, regras: g };
    const f = g.fracao_ibs ?? 1;
    return { cbs: r.cbs, ibs_uf: arred(r.ibs_uf * f, 4), ibs_mun: arred(r.ibs_mun * f, 4), regras: g };
  }

  const arred = (v, casas = 2) => { const m = 10 ** casas; return Math.round((+v || 0) * m + Number.EPSILON * m) / m; };
  const efetiva = (aliquota, reducao) => arred(aliquota * (1 - (+reducao || 0) / 100), 4);

  // Redução de uma cClassTrib (dados/cclasstrib.json): { CBS, IBSUF, IBSMun } em %
  function reducoes(cclass) {
    const r = (cclass && cclass.red) || {};
    return { cbs: +r.CBS || 0, ibs_uf: +r.IBSUF || 0, ibs_mun: +r.IBSMun || 0 };
  }

  // cClassTrib sem alíquota (imunidade, suspensão, não incidência…) não gera tributo
  const semTributo = c => !!c && /^(Sem al[ií]quota)$/i.test(c.tipo_aliquota || '');

  // Tipos que o simulador não calcula sozinho (alíquota por unidade, monofásicos, Imposto Seletivo)
  const precisaCalculadoraOficial = c => !!c && /^(Fixa|Al[ií]quotas Combinadas)/i.test(c.tipo_aliquota || '');

  // Tributo de uma linha (receita ou compra)
  function calcularLinha(valor, cclass, aliq) {
    const base = +valor || 0;
    if (semTributo(cclass)) return { base, cbs: 0, ibs_uf: 0, ibs_mun: 0, ibs: 0, total: 0, efetivas: { cbs: 0, ibs_uf: 0, ibs_mun: 0 } };
    const red = reducoes(cclass);
    const ef = { cbs: efetiva(aliq.cbs, red.cbs), ibs_uf: efetiva(aliq.ibs_uf, red.ibs_uf), ibs_mun: efetiva(aliq.ibs_mun, red.ibs_mun) };
    const cbs = arred(base * ef.cbs / 100), ibs_uf = arred(base * ef.ibs_uf / 100), ibs_mun = arred(base * ef.ibs_mun / 100);
    return { base, cbs, ibs_uf, ibs_mun, ibs: arred(ibs_uf + ibs_mun), total: arred(cbs + ibs_uf + ibs_mun), efetivas: ef,
      aviso: precisaCalculadoraOficial(cclass) ? 'Alíquota fixa/por unidade ou Imposto Seletivo: confira na calculadora oficial.' : '' };
  }

  /*
   * Simulação de um mês (ou de qualquer período, os valores são somados):
   *  cenario = {
   *    ano, regime: 'regular' | 'simples' | 'simples_por_fora',
   *    ref: { cbs, ibs_uf, ibs_mun },
   *    receitas: [{ descricao, valor, cclass }],          (cclass = objeto de dados/cclasstrib.json)
   *    compras:  [{ descricao, valor, cclass, credito }],  (credito=false: compra sem direito a crédito)
   *    atual:    { icms, iss, pis_cofins, ipi }             (valores em R$ dos tributos de hoje no mesmo período)
   *  }
   */
  function simular(cenario) {
    const c = cenario || {};
    const ano = +c.ano || 2027;
    const aliq = aliquotasAno(ano, c.ref);
    const g = aliq.regras;
    const receitas = (c.receitas || []).map(r => ({ ...r, ...calcularLinha(r.valor, r.cclass, aliq) }));
    const compras = (c.compras || []).map(r => {
      const l = calcularLinha(r.valor, r.cclass, aliq);
      const credita = r.credito !== false && !(r.cclass && r.cclass.credito_adq && r.cclass.credito_adq.CBS === false && r.cclass.credito_adq.IBS === false);
      return { ...r, ...l, credito_cbs: credita ? l.cbs : 0, credito_ibs: credita ? l.ibs : 0 };
    });
    const soma = (lst, k) => arred(lst.reduce((s, x) => s + (+x[k] || 0), 0));
    const faturamento = soma(receitas, 'base');
    const debito = { cbs: soma(receitas, 'cbs'), ibs: soma(receitas, 'ibs') };
    const credito = { cbs: soma(compras, 'credito_cbs'), ibs: soma(compras, 'credito_ibs') };
    const simples = c.regime === 'simples';
    // No Simples "por dentro" o IBS/CBS fica dentro do DAS: a empresa não toma crédito e o simulador
    // mostra só o que o cliente PJ dela poderia creditar (o destacado na nota).
    const apagar = simples ? { cbs: 0, ibs: 0 } : { cbs: Math.max(0, arred(debito.cbs - credito.cbs)), ibs: Math.max(0, arred(debito.ibs - credito.ibs)) };
    const saldo_credor = simples ? { cbs: 0, ibs: 0 } : { cbs: Math.max(0, arred(credito.cbs - debito.cbs)), ibs: Math.max(0, arred(credito.ibs - debito.ibs)) };
    const atual = c.atual || {};
    const legado = {
      icms: arred((+atual.icms || 0) * g.legado), iss: arred((+atual.iss || 0) * g.legado),
      pis_cofins: g.pis_cofins ? arred(+atual.pis_cofins || 0) : 0, ipi: g.ipi ? arred(+atual.ipi || 0) : 0,
    };
    // 2026: IBS/CBS de teste não é recolhido (compensa PIS/COFINS) — não soma na carga
    const ibscbs_carga = ano <= 2026 || simples ? 0 : arred(apagar.cbs + apagar.ibs);
    const carga_nova = arred(ibscbs_carga + legado.icms + legado.iss + legado.pis_cofins + legado.ipi);
    const carga_atual = arred((+atual.icms || 0) + (+atual.iss || 0) + (+atual.pis_cofins || 0) + (+atual.ipi || 0));
    return {
      ano, regime: c.regime || 'regular', aliquotas: { cbs: aliq.cbs, ibs_uf: aliq.ibs_uf, ibs_mun: aliq.ibs_mun }, regras: g,
      receitas, compras, faturamento, debito, credito, apagar, saldo_credor, legado,
      carga_atual, carga_nova, diferenca: arred(carga_nova - carga_atual),
      perc_atual: faturamento ? arred(carga_atual / faturamento * 100) : 0,
      perc_nova: faturamento ? arred(carga_nova / faturamento * 100) : 0,
      estimativa: ano >= 2027,
    };
  }

  // A mesma simulação ano a ano (2026–2033)
  const projecao = cenario => ANOS.map(ano => simular({ ...cenario, ano }));

  // ── consultas nas tabelas oficiais ──
  const semAcento = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const digitos = s => String(s ?? '').replace(/\D/g, '');

  // Busca por código ou palavras (todas as palavras precisam aparecer)
  function buscar(lista, termo, campos, limite = 50) {
    const t = semAcento(termo).trim();
    if (!t) return lista.slice(0, limite);
    const palavras = t.split(/\s+/);
    const d = digitos(t);
    const out = [];
    for (const item of lista) {
      const texto = semAcento(campos.map(k => item[k]).join(' '));
      const codigo = digitos(item[campos[0]]);
      if ((d && d.length >= 2 && /^\d[\d.\-/\s]*$/.test(t) && codigo.startsWith(d)) || palavras.every(p => texto.includes(p))) {
        out.push(item);
        if (out.length >= limite) break;
      }
    }
    return out;
  }

  // cClassTrib que valem para um NCM (o vínculo pode ser só o capítulo/posição, e pode ter exceções)
  function classificacoesNcm(ncm, aplicaveis) {
    const n = digitos(ncm);
    if (!n) return [];
    return (aplicaveis || []).filter(a => {
      const p = digitos(a.ncm);
      if (!p || !n.startsWith(p)) return false;
      const exc = String(a.excecoes || '').split(',').map(digitos).filter(Boolean);
      return !exc.some(e => n.startsWith(e));
    });
  }

  // cClassTrib de um item da lista de serviços do ISS (LC 116), pelos NBS vinculados
  function classificacoesServico(itemLc116, porId) {
    const ids = [...new Set(((itemLc116 && itemLc116.vinculos) || []).map(v => v.cclass))];
    return ids.map(id => porId[id]).filter(Boolean);
  }

  const api = {
    REFERENCIA_PADRAO, ANOS, regrasAno, aliquotasAno, efetiva, reducoes, calcularLinha, simular, projecao,
    buscar, classificacoesNcm, precisaCalculadoraOficial, classificacoesServico, arred, semAcento, digitos,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Reforma = api;
})(typeof window !== 'undefined' ? window : globalThis);
