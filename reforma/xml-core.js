/*
 * Leitura de XMLs de NF-e/NFC-e (modelo 55/65) e NFS-e do padrão nacional para a Reforma Tributária:
 * itens com NCM/NBS/serviço, sugestão de cClassTrib e montagem da operação para a calculadora oficial.
 * Funções puras (sem tela), testadas em tests/reforma-xml.test.js.
 */
(function (root) {
  const R = root.Reforma || (typeof require !== 'undefined' ? require('./reforma-core.js') : null);

  // Conteúdo de uma tag (com ou sem prefixo de namespace); só a primeira ocorrência
  function tag(xml, nome) {
    const m = new RegExp(`<(?:\\w+:)?${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${nome}>`).exec(xml || '');
    return m ? decodificar(m[1].trim()) : '';
  }
  function blocos(xml, nome) {
    const re = new RegExp(`<(?:\\w+:)?${nome}(\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${nome}>`, 'g');
    const out = []; let m;
    while ((m = re.exec(xml || ''))) out.push({ attrs: m[1] || '', corpo: m[2] });
    return out;
  }
  const decodificar = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const num = s => { const v = parseFloat(String(s || '').replace(',', '.')); return isFinite(v) ? v : 0; };

  // Lê um XML e devolve { tipo, chave, numero, data, emitente:{cnpj,nome}, uf, municipio, itens:[...] }
  function lerXml(xml) {
    const s = String(xml || '');
    if (/<(?:\w+:)?infNFe[\s>]/.test(s)) {
      const ide = tag(s, 'ide'), emit = tag(s, 'emit'), ender = tag(emit, 'enderEmit');
      const chaveAttr = /<(?:\w+:)?infNFe[^>]*\sId="NFe(\d{44})"/.exec(s);
      const itens = blocos(s, 'det').map(d => {
        const p = tag(d.corpo, 'prod'), ibscbs = tag(d.corpo, 'IBSCBS');
        return {
          n: +((/nItem="(\d+)"/.exec(d.attrs) || [])[1] || 0),
          codigo: tag(p, 'cProd'), descricao: tag(p, 'xProd'), ncm: tag(p, 'NCM'), cfop: tag(p, 'CFOP'),
          unidade: tag(p, 'uCom') || 'UN', quantidade: num(tag(p, 'qCom')) || 1,
          valor: num(tag(p, 'vProd')) - num(tag(p, 'vDesc')),
          cst_nota: tag(ibscbs, 'CST'), cclass_nota: tag(ibscbs, 'cClassTrib'),
        };
      });
      return {
        tipo: tag(ide, 'mod') === '65' ? 'NFC-e' : 'NF-e', modelo: +tag(ide, 'mod') || 55,
        chave: chaveAttr ? chaveAttr[1] : '', numero: tag(ide, 'nNF'), data: (tag(ide, 'dhEmi') || tag(ide, 'dEmi')).slice(0, 10),
        emitente: { cnpj: tag(emit, 'CNPJ') || tag(emit, 'CPF'), nome: tag(emit, 'xNome') },
        uf: tag(ender, 'UF'), municipio: +tag(ender, 'cMun') || null, saida: tag(ide, 'tpNF') !== '0', itens,
      };
    }
    if (/<(?:\w+:)?infDPS[\s>]/.test(s) || /<(?:\w+:)?infNFSe[\s>]/.test(s)) {
      const dps = tag(s, 'infDPS') || s, prest = tag(dps, 'prest'), serv = tag(dps, 'serv'), cserv = tag(serv, 'cServ');
      const ibscbs = tag(s, 'IBSCBS');
      const cTrib = tag(cserv, 'cTribNac');
      return {
        tipo: 'NFS-e', modelo: 99, chave: (/Id="NFS(\d+)"/.exec(s) || [])[1] || '', numero: tag(s, 'nNFSe') || tag(dps, 'nDPS'),
        data: (tag(dps, 'dhEmi') || tag(s, 'dhProc')).slice(0, 10),
        emitente: { cnpj: tag(prest, 'CNPJ') || tag(prest, 'CPF'), nome: tag(prest, 'xNome') || tag(tag(s, 'emit'), 'xNome') },
        uf: tag(tag(s, 'emit'), 'UF'), municipio: +tag(dps, 'cLocEmi') || null, saida: true,
        itens: [{
          n: 1, codigo: cTrib, descricao: tag(cserv, 'xDescServ'), nbs: tag(cserv, 'cNBS'), item_lc116: itemLc116(cTrib),
          unidade: 'UN', quantidade: 1, valor: num(tag(tag(dps, 'vServPrest'), 'vServ')) || num(tag(s, 'vServ')),
          cst_nota: tag(ibscbs, 'CST'), cclass_nota: tag(ibscbs, 'cClassTrib'),
        }],
      };
    }
    throw new Error('XML não reconhecido (esperado NF-e, NFC-e ou NFS-e do padrão nacional).');
  }

  // cTribNac "010101" → item "1.01" da LC 116
  function itemLc116(cTribNac) {
    const d = String(cTribNac || '').replace(/\D/g, '');
    if (d.length < 4) return '';
    return `${+d.slice(0, 2)}.${d.slice(2, 4)}`;
  }

  // Junta os itens iguais de várias notas: mercadoria pelo código + NCM; serviço pelo código do serviço + NBS
  function agrupar(notas) {
    const g = new Map();
    for (const nota of notas) for (const it of nota.itens) {
      const chave = it.ncm !== undefined && it.ncm !== '' ? `M|${it.codigo}|${it.ncm}` : `S|${it.codigo}|${it.nbs || ''}`;
      const a = g.get(chave) || { chave, codigo: it.codigo, descricao: it.descricao, ncm: it.ncm || '', nbs: it.nbs || '', item_lc116: it.item_lc116 || '',
        unidade: it.unidade, quantidade: 0, valor: 0, notas: 0, cclass_nota: '', cst_nota: '' };
      a.quantidade += it.quantidade; a.valor = Math.round((a.valor + it.valor) * 100) / 100; a.notas += 1;
      if (it.cclass_nota && !a.cclass_nota) { a.cclass_nota = it.cclass_nota; a.cst_nota = it.cst_nota; }
      g.set(chave, a);
    }
    return [...g.values()].sort((a, b) => b.valor - a.valor);
  }

  /*
   * Sugestões de cClassTrib para um item agrupado.
   * tabelas = { cclass (lista), ncm_aplicavel, nbs_aplicavel, lc116 }
   * Devolve [{ cclass, motivo }] — a primeira é a sugerida.
   */
  function sugerir(item, tabelas) {
    const porId = {}; (tabelas.cclass || []).forEach(c => { porId[c.id] = c; });
    const porCd = cd => (tabelas.cclass || []).find(c => c.cd === cd);
    const out = []; const vistos = new Set();
    const add = (c, motivo) => { if (c && !vistos.has(c.id)) { vistos.add(c.id); out.push({ cclass: c, motivo }); } };
    if (item.ncm) {
      R.classificacoesNcm(item.ncm, tabelas.ncm_aplicavel || []).forEach(a => add(porId[a.cclass], `NCM ${a.ncm}${a.anexo ? ` no Anexo ${a.anexo}, item ${a.item}` : ''}: confira a descrição`));
    }
    if (item.nbs) {
      (tabelas.nbs_aplicavel || []).filter(a => item.nbs.startsWith(a.nbs)).forEach(a => add(porId[a.cclass], `NBS ${a.nbs}${a.anexo ? ` no Anexo ${a.anexo}` : ''}`));
    }
    if (item.item_lc116) {
      const s = (tabelas.lc116 || []).find(l => l.cd === item.item_lc116);
      if (s) R.classificacoesServico(s, porId).forEach(c => add(c, `Serviço ${s.cd} da LC 116`));
    }
    // Regra geral por último: mercadoria/serviço sem vínculo específico é tributado integralmente
    add(porCd('000001'), out.length ? 'Regra geral, se não se enquadrar nas anteriores' : 'Sem vínculo específico: tributação integral');
    return out;
  }

  /*
   * Operação no formato da calculadora oficial (POST regime-geral).
   * itens: [{ ncm?, nbs?, cst, cClassTrib, baseCalculo, quantidade?, unidade? }]
   * aliquotas: { cbs, ibs_uf, ibs_mun } — obrigatórias a partir de 2027 (ainda não fixadas em lei)
   */
  function operacao({ data, uf, municipio, itens, aliquotas, id }) {
    const ano = +String(data || '').slice(0, 4);
    return {
      id: id || 'portal-' + Date.now(), versao: '1.0.0', dhFatoGerador: `${data}T12:00:00-03:00`,
      municipio: +municipio, uf,
      itens: itens.map((it, i) => {
        const o = { numero: i + 1, cst: it.cst, cClassTrib: it.cClassTrib, baseCalculo: R.arred(+it.baseCalculo || 0), quantidade: +it.quantidade || 1, unidade: it.unidade || 'UN' };
        if (it.ncm) o.ncm = String(it.ncm).replace(/\D/g, '');
        if (it.nbs) o.nbs = String(it.nbs).replace(/\D/g, '');
        if (ano >= 2027 && aliquotas) o.aliquotasNominais = { cbs: +aliquotas.cbs, ibsEstadual: +aliquotas.ibs_uf, ibsMunicipal: +aliquotas.ibs_mun };
        return o;
      }),
    };
  }

  // Resumo de uma resposta da calculadora (observabilidade ou regime-geral) por item
  function resumoResposta(resp) {
    return ((resp && resp.objetos) || []).map(o => {
      const t = (o.tribCalc && o.tribCalc.IBSCBS) || {}, g = t.gIBSCBS || {};
      const v = k => num(k);
      return {
        n: o.nObj, estado: o.estadoItem || 'CALCULADO', erros: o.erros || [],
        cst: t.CST, cClassTrib: t.cClassTrib, base: v(g.vBC),
        cbs: { p: v(g.gCBS && g.gCBS.pCBS), red: v(g.gCBS && g.gCBS.gRed && g.gCBS.gRed.pRedAliq), efet: g.gCBS && g.gCBS.gRed ? v(g.gCBS.gRed.pAliqEfet) : v(g.gCBS && g.gCBS.pCBS), v: v(g.gCBS && g.gCBS.vCBS), memoria: (g.gCBS && g.gCBS.memoriaCalculo) || '' },
        ibsuf: { p: v(g.gIBSUF && g.gIBSUF.pIBSUF), v: v(g.gIBSUF && g.gIBSUF.vIBSUF) },
        ibsmun: { p: v(g.gIBSMun && g.gIBSMun.pIBSMun), v: v(g.gIBSMun && g.gIBSMun.vIBSMun) },
        ibs: v(g.vIBS), is: o.tribCalc && o.tribCalc.IS ? v(o.tribCalc.IS.vIS) : 0,
      };
    });
  }

  const csv = linhas => linhas.map(l => l.map(c => {
    const t = String(c ?? '');
    return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  }).join(';')).join('\r\n');

  const api = { lerXml, itemLc116, agrupar, sugerir, operacao, resumoResposta, csv, tag };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ReformaXml = api;
})(typeof window !== 'undefined' ? window : globalThis);
