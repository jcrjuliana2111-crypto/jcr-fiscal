/*
 * Conferidor de documentos societários (sem tela): recebe o texto das páginas dos PDFs
 * (capas, fichas cadastrais, requerimentos, declarações e contrato gerados para a JUCESP)
 * e aponta divergências antes da assinatura e do protocolo.
 *
 * Página: { arquivo, numero, texto } — texto em linhas, colunas separadas por 3+ espaços
 * (formato de linhasDePagina, que monta as linhas a partir dos itens de texto do pdf.js).
 * Achado: { nivel: 'erro' | 'atencao' | 'info' | 'ok', titulo, detalhe, paginas: ['arquivo p.N'] }
 *
 * Cada exigência nova da JUCESP deve virar uma regra aqui (ver REGRAS no fim do arquivo).
 */
(function (root) {
  // ── texto ──
  const semAcento = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const norm = s => semAcento(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const tokens = s => norm(s).split(' ').filter(Boolean);

  // Monta linhas a partir dos itens do pdf.js ({ str, transform: [a,b,c,d,x,y], width }),
  // mantendo as colunas pela posição x (1 caractere ≈ 4 pt), como um "texto com layout".
  const PT_COL = 4;
  const ROTULO = '\u2063'; // separador invisível: marca linha de rótulos
  function linhasDePagina(itens) {
    const vis = itens.filter(i => i.str && i.str.trim() !== '');
    const linhas = [];
    vis.forEach(i => {
      const y = i.transform[5];
      let l = linhas.find(x => Math.abs(x.y - y) < 2.5);
      if (!l) { l = { y, itens: [] }; linhas.push(l); }
      l.itens.push(i);
    });
    linhas.sort((a, b) => b.y - a.y);
    // Formulários da JUCESP: rótulos em fonte menor que os valores. Linha só de rótulos ganha
    // o marcador ROTULO no início, para campo() não confundir rótulo com valor quando o campo está vazio.
    const tamanho = i => Math.abs(i.transform[0]) || 0;
    // os dois tamanhos mais frequentes: o menor é o dos rótulos, o maior o dos valores
    const freq = {};
    vis.forEach(i => { const t = tamanho(i).toFixed(1); freq[t] = (freq[t] || 0) + 1; });
    const [e1, e2] = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    // só vale quando os dois tamanhos são usados em quantidade parecida (rótulo + valor em cada campo)
    const tRotulo = e2 && e2[1] >= e1[1] * 0.25 && Math.abs(e1[0] - e2[0]) >= 1.5 ? Math.min(+e1[0], +e2[0]) : null;
    return linhas.map(l => {
      const rotulo = tRotulo != null && Math.max(...l.itens.map(tamanho)) <= tRotulo + 0.3;
      l.itens.sort((a, b) => a.transform[4] - b.transform[4]);
      let s = '', fim = null;
      l.itens.forEach(i => {
        const x = i.transform[4], tam = Math.abs(i.transform[0]) || 8, col = Math.round(x / PT_COL);
        if (fim === null) s = ' '.repeat(col);
        else {
          const gap = x - fim;
          if (gap > tam * 1.2) s = s.replace(/\s+$/, '') + ' '.repeat(Math.max(3, col - s.replace(/\s+$/, '').length));
          else if (gap > tam * 0.15 && !s.endsWith(' ') && !i.str.startsWith(' ')) s += ' ';
        }
        s += i.str;
        fim = x + (i.width || 0);
      });
      s = s.replace(/\s+$/, '');
      return rotulo ? ROTULO + s.slice(1) : s;
    }).join('\n');
  }

  // Valor do campo: linha seguinte ao rótulo, na mesma coluna (por posição do rótulo)
  function campo(texto, rotulo) {
    const linhas = texto.split('\n');
    for (let i = 0; i < linhas.length - 1; i++) {
      const pos = semAcento(linhas[i]).toUpperCase().indexOf(semAcento(rotulo).toUpperCase());
      if (pos < 0) continue;
      const prox = linhas[i + 1];
      if (!prox || prox.startsWith(ROTULO)) return '';
      // segmentos da linha de valores com a posição de início
      const segs = [];
      const re = /\S+(?: {1,2}\S+)*/g;
      let m;
      while ((m = re.exec(prox))) segs.push({ ini: m.index, txt: m[0] });
      if (!segs.length) return '';
      // segmento que começa mais perto da coluna do rótulo (tolerância para alinhamentos)
      const cand = segs.filter(s => Math.abs(s.ini - pos) <= 12);
      if (!cand.length) return '';
      cand.sort((a, b) => Math.abs(a.ini - pos) - Math.abs(b.ini - pos));
      return cand[0].txt.trim();
    }
    return null;
  }

  // ── classificação das páginas ──
  const TIPOS_DOC = [
    ['capa', /CAPA DO REQUERIMENTO/i],
    ['exigencias', /FORMUL[AÁ]RIO PADRONIZADO DE EXIG[EÊ]NCIAS/i],
    ['ficha', /Ficha Cadastral - Modelo/i],
    ['quadro', /Ficha Cadastral - Quadro Societ/i],
    ['requerimento_empresario', /Requerimento de Empres[aá]rio/i],
    ['desimpedimento', /DECLARA[CÇ][AÃ]O DE DESIMPEDIMENTO/i],
    ['enquadramento', /DECLARA[CÇ][AÃ]O DE ENQUADRAMENTO/i],
    ['licenciamento', /CERTIFICADO DE LICENCIAMENTO INTEGRADO/i],
    ['assinaturas', /Relat[oó]rio de (auditoria|Assinaturas)|validar\.iti\.gov\.br|ZapSign/i],
    ['contrato', /Cl[aá]usula\s+(Primeira|Segunda|Terceira|\d)/i],
  ];
  const NOMES_DOC = {
    capa: 'Capa do requerimento', exigencias: 'Formulário de exigências', ficha: 'Ficha cadastral',
    quadro: 'Quadro societário', requerimento_empresario: 'Requerimento de empresário', desimpedimento: 'Declaração de desimpedimento',
    enquadramento: 'Declaração de enquadramento', licenciamento: 'Declaração de licenciamento', assinaturas: 'Relatório de assinaturas',
    contrato: 'Contrato / instrumento', outro: 'Outro',
  };
  function classificar(texto) {
    // páginas da lista de exigências: várias linhas "1.1   Substituir…", "12.2   Existência…"
    if ((texto.match(/^\s*\d{1,2}\.\d{1,2}(\.\d)?\s{2,}\S/gm) || []).length >= 3 && !/Cl[aá]usula\s+(Primeira|Segunda)/i.test(texto)) return 'exigencias';
    for (const [t, re] of TIPOS_DOC) if (re.test(texto)) return t;
    return 'outro';
  }
  // Páginas sem título próprio (continuação) herdam o tipo da anterior
  function tipar(paginas) {
    let ant = 'outro', arqAnt = null;
    return paginas.map(p => {
      let t = classificar(p.texto);
      if (t === 'outro' && p.arquivo === arqAnt && ['contrato', 'exigencias'].includes(ant)) t = ant;
      if (t === 'contrato' && ant === 'contrato') t = 'contrato';
      ant = t; arqAnt = p.arquivo;
      return { ...p, tipo: t, ref: `${p.arquivo} p.${p.numero}` };
    });
  }

  // ── similaridade ──
  function lev(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  const sim = (a, b) => { const x = norm(a), y = norm(b); return 1 - lev(x, y) / Math.max(x.length, y.length, 1); };

  // Variações de uma expressão (nome, logradouro, bairro) ao longo das páginas
  function variantes(paginas, referencia, minimo = 0.72) {
    const rt = tokens(referencia);
    if (rt.length < 2) return [];
    // âncora: palavra mais longa da referência
    let k = 0; rt.forEach((t, i) => { if (t.length > rt[k].length) k = i; });
    const achadas = new Map();
    paginas.forEach(p => {
      const pt = tokens(p.texto);
      pt.forEach((t, idx) => {
        if (sim(t, rt[k]) < 0.75) return;
        let melhor = null;
        for (let d = -1; d <= 1; d++) for (let len = rt.length - 1; len <= rt.length + 1; len++) {
          const ini = idx - k + d;
          if (ini < 0 || ini + len > pt.length) continue;
          const jan = pt.slice(ini, ini + len).join(' ');
          const s = sim(jan, rt.join(' '));
          if (!melhor || s > melhor.s) melhor = { s, jan };
        }
        if (melhor && melhor.s >= minimo) {
          const e = achadas.get(melhor.jan) || { texto: melhor.jan, s: melhor.s, paginas: new Set() };
          e.paginas.add(p.ref);
          achadas.set(melhor.jan, e);
        }
      });
    });
    return [...achadas.values()].map(v => ({ ...v, paginas: [...v.paginas] })).sort((a, b) => b.s - a.s);
  }

  // ── CPF ──
  function cpfValido(c) {
    const d = c.replace(/\D/g, '');
    if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
    const dv = n => { let s = 0; for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
    return dv(9) === +d[9] && dv(10) === +d[10];
  }

  // ── valores ──
  const reais = s => { const m = String(s || '').match(/R\$\s*([\d.]+,\d{2})/); return m ? +m[1].replace(/\./g, '').replace(',', '.') : null; };
  const dataISO = s => { const m = String(s || '').match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
  const BR = iso => iso.split('-').reverse().join('/');
  const MESES = { janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };
  function dataExtensoISO(s) {
    const todas = [...norm(s).matchAll(/(\d{1,2}) de ([a-z]+) de (\d{4})/g)];
    const m = todas[todas.length - 1]; // a data do fecho é a última do texto
    return m && MESES[m[2]] ? `${m[3]}-${String(MESES[m[2]]).padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
  }

  // ── análise ──
  function analisar(paginasEntrada, ref = {}) {
    const paginas = tipar(paginasEntrada);
    const achados = [];
    const add = (nivel, titulo, detalhe, pags) => achados.push({ nivel, titulo, detalhe, paginas: pags || [] });
    const doTipo = t => paginas.filter(p => p.tipo === t);
    const contrato = doTipo('contrato');
    const textoContrato = contrato.map(p => p.texto).join('\n');
    const corrido = textoContrato.replace(/\s+/g, ' ').replace(/(\d{4}-) (\d\/\d{2})/g, '$1$2');
    const formularios = paginas.filter(p => !['contrato', 'exigencias', 'assinaturas', 'outro'].includes(p.tipo));
    const relevantes = paginas.filter(p => p.tipo !== 'exigencias');

    // Capas: atos do pacote
    const capas = doTipo('capa').filter(p => /\bATO\b/.test(p.texto) && /SEQ\. DOC/.test(p.texto)).map(p => ({
      ref: p.ref,
      ato: campo(p.texto, 'ATO') || '',
      nome: campo(p.texto, 'NOME EMPRESARIAL') || '',
      porte: campo(p.texto, 'PORTE') || '',
      cnpj: (p.texto.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/) || [''])[0],
      data: dataISO((p.texto.match(/DATA:\s*(\d{2}\/\d{2}\/\d{4})/) || [])[1]),
      seq: (p.texto.match(/(\d+)\s*\/\s*(\d+)\s*$/m) || [''])[0].replace(/\s/g, ''),
      exig: campo(p.texto, 'NÚMERO EXIGÊNCIA') || '',
    }));

    // 1. Ato de cancelamento com transferência de acervo: dados da empresa individual, não da destinatária
    capas.forEach(c => {
      const m = c.ato.match(/transfer[eê]ncia de seu acervo para (.+?);?$/i);
      if (m && sim(c.nome, m[1]) > 0.9) {
        add('erro', `Capa ${c.seq || ''}: ato de cancelamento com o nome da empresa que recebe o acervo`.replace('  ', ' '),
          `O ato "${c.ato}" é da empresa individual que está sendo cancelada, mas o nome empresarial da capa é "${c.nome}" (porte ${c.porte || '—'}). ` +
          'Preencha nome, porte e demais dados com os da ficha cadastral da empresa individual. (Exigência já recebida da JUCESP: "vir com os dados da empresa individual".)', [c.ref]);
      }
    });
    doTipo('requerimento_empresario').forEach(p => {
      const ato = campo(p.texto, 'ATO(S)') || '';
      const dest = (ato.match(/acervo para (.+?);?$/i) || [])[1];
      const nome = campo(p.texto, 'NOME EMPRESARIAL') || '';
      if (dest && sim(nome, dest) > 0.9) {
        add('erro', 'Requerimento de empresário com o nome da empresa que recebe o acervo',
          `O requerimento cancela a empresa individual, mas o nome empresarial informado é "${nome}". Use o nome que está na ficha da empresa individual.`, [p.ref]);
      }
      if (dest) {
        const vazios = [['VALOR DO CAPITAL (R$)', 'capital'], ['DATA DE INICIO DAS ATIVIDADES', 'data de início']]
          .filter(([r]) => { const v = campo(p.texto, r); return v === '' || v === null; }).map(([, n]) => n);
        if (/CODIGO DE ATIVIDADE\s*\n\s*Atividade Principal\s*$/mi.test(semAcento(p.texto))) vazios.push('atividade');
        if (vazios.length) add('atencao', 'Requerimento de empresário com campos em branco',
          `Campos sem preenchimento: ${vazios.join(', ')}. Preencha com os dados da ficha da empresa individual.`, [p.ref]);
      }
    });

    // 2. Datas das capas
    const datas = [...new Set(capas.map(c => c.data).filter(Boolean))];
    if (datas.length > 1) add('atencao', 'Capas com datas diferentes',
      capas.map(c => `${c.seq}: ${c.data ? BR(c.data) : '—'}`).join(' · ') + '. O ideal é a mesma data em todo o pacote.', capas.map(c => c.ref));
    const exigs = [...new Set(capas.map(c => c.exig).filter(Boolean))];
    if (exigs.some(e => +e >= 2)) add('atencao', `Reentrada nº ${exigs.join('/')}`,
      'Processo já voltou em exigência. Anexe o formulário de exigência devolvido pela JUCESP e confirme o prazo de 30 dias da retirada (depois disso há nova taxa). ' +
      'Reiteradas exigências sobre o mesmo tema podem levar ao indeferimento.', capas.map(c => c.ref));

    // 3. Nome do sócio / titular
    const nomesRef = new Set();
    if (ref.socio) nomesRef.add(ref.socio.trim().toUpperCase());
    paginas.forEach(p => {
      ['NOME DO INTEGRANTE', 'NOME DO EMPRESÁRIO'].forEach(r => { const v = campo(p.texto, r); if (v && v.split(' ').length >= 2) nomesRef.add(v.toUpperCase()); });
    });
    nomesRef.forEach(nome => {
      const vs = variantes(relevantes, nome, 0.8);
      const certos = vs.filter(v => v.texto === norm(nome));
      const errados = vs.filter(v => v.texto !== norm(nome) && v.s >= 0.85);
      errados.forEach(v => add('erro', `Nome do sócio escrito diferente: "${v.texto.toUpperCase()}"`,
        `O nome correto é "${nome}" (${certos.length ? certos[0].paginas.length + ' página(s)' : 'referência'}). Corrija onde aparece diferente.`, v.paginas));
      if (vs.length && !errados.length) add('ok', `Nome "${nome}" igual em todos os documentos`, '', []);
    });

    // 4. CPFs válidos
    const cpfs = new Map();
    relevantes.forEach(p => (p.texto.match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g) || []).forEach(c => { if (!cpfs.has(c)) cpfs.set(c, new Set()); cpfs.get(c).add(p.ref); }));
    cpfs.forEach((pags, c) => { if (!cpfValido(c)) add('erro', `CPF inválido: ${c}`, 'Dígitos verificadores não conferem.', [...pags]); });
    if (cpfs.size && [...cpfs.keys()].every(cpfValido)) add('ok', `CPF${cpfs.size > 1 ? 's' : ''} válido${cpfs.size > 1 ? 's' : ''}`, [...cpfs.keys()].join(', '), []);

    // 5. Endereço: logradouro e bairro iguais em todos os documentos
    const ficha = doTipo('ficha')[0];
    const logrRef = ref.logradouro || (ficha && campo(ficha.texto, 'LOGRADOURO')) || (capas[0] && campo(doTipo('capa')[0].texto, 'LOGRADOURO'));
    const bairroRef = ref.bairro || (ficha && campo(ficha.texto, 'BAIRRO/DISTRITO'));
    [['Logradouro', logrRef], ['Bairro', bairroRef]].forEach(([rot, r]) => {
      if (!r) return;
      const base = norm(r.replace(/\(.*?\)/g, ''));
      const vs = variantes(relevantes, r.replace(/\(.*?\)/g, ''), 0.7);
      const dif = vs.filter(v => v.texto !== base);
      if (dif.length) {
        const todas = vs.map(v => `"${v.texto}" (${v.paginas.length} pág.)`).join(' x ');
        add('erro', `${rot} escrito de formas diferentes`, `${todas}. Use em todos a grafia do IPTU/DBE${ref.logradouro || ref.bairro ? '' : ` (referência usada: ficha cadastral, "${r}")`}.`,
          dif.flatMap(v => v.paginas));
      } else if (vs.length) add('ok', `${rot} igual em todos os documentos`, r, []);
    });

    // 6. Objeto: ficha cadastral x contrato
    if (ficha && textoContrato) {
      const desc = (ficha.texto.match(/DESCRI[CÇ][AÃ]O DO OBJETO SOCIAL\s*\n([\s\S]*?)\n\s*DEPENDE/i) || [])[1];
      if (desc) {
        const vocab = new Set(tokens(textoContrato));
        const estranhas = [...new Set(tokens(desc).filter(w => w.length >= 4 && !vocab.has(w)))];
        if (estranhas.length) add('erro', 'Descrição do objeto na ficha cadastral diferente do contrato',
          `Palavras que não existem no contrato (erros de digitação ou texto diferente): ${estranhas.join(', ')}. Copie para a ficha exatamente o objeto da cláusula do contrato.`, [ficha.ref]);
        else add('ok', 'Objeto da ficha cadastral compatível com o contrato', '', []);
      }
      const cnaeFicha = new Set((ficha.texto.match(/^\s*(\d{7})\s+-/gm) || []).map(s => s.trim().slice(0, 7)));
      const cnaeContrato = new Set((corrido.match(/\b\d{4}-\d\/\d{2}\b/g) || []).map(s => s.replace(/\D/g, '')));
      const soFicha = [...cnaeFicha].filter(c => !cnaeContrato.has(c)), soContrato = [...cnaeContrato].filter(c => !cnaeFicha.has(c));
      if (cnaeFicha.size && cnaeContrato.size) {
        if (soFicha.length || soContrato.length) add('erro', 'CNAEs diferentes entre ficha cadastral e contrato',
          `Só na ficha: ${soFicha.join(', ') || '—'}. Só no contrato: ${soContrato.join(', ') || '—'}.`, [ficha.ref, ...contrato.map(p => p.ref)]);
        else add('ok', `CNAEs iguais na ficha e no contrato (${cnaeFicha.size})`, '', []);
      }
    }

    // 7. Capital: ficha x contrato
    if (ficha && textoContrato) {
      const capFicha = reais((ficha.texto.match(/Valor do Capital:[^\n]*/i) || [''])[0]);
      const capContrato = reais((corrido.match(/capital social [eé] de R\$\s*[\d.]+,\d{2}/i) || [''])[0]);
      if (capFicha != null && capContrato != null) {
        if (capFicha !== capContrato) add('erro', 'Capital diferente entre ficha cadastral e contrato', `Ficha: R$ ${capFicha.toFixed(2)} · contrato: R$ ${capContrato.toFixed(2)}.`, [ficha.ref, ...contrato.map(p => p.ref)]);
        else add('ok', 'Capital igual na ficha e no contrato', `R$ ${capFicha.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, []);
      }
    }

    // 8. Data de início x assinatura
    if (ficha) {
      const ini = dataISO(campo(ficha.texto, 'INICIO DAS ATIVIDADES'));
      const ass = dataISO(campo(ficha.texto, 'DATA DE ASSINATURA DO DOCUMENTO'));
      if (ini && ass && ini < ass) add(/acervo/i.test(ficha.texto) ? 'info' : 'atencao', 'Data de início das atividades anterior à assinatura',
        `Início ${BR(ini)}, assinatura ${BR(ass)}. Na constituição isso gera exigência (Manual de LTDA, item 5.1). Na transformação o modelo do DREI admite a data original; se vier exigência, retire a data e mantenha só o prazo indeterminado.`, [ficha.ref]);
      if (ini && textoContrato && !corrido.includes(BR(ini))) add('atencao', 'Data de início da ficha não aparece no contrato', `Ficha: ${BR(ini)}.`, [ficha.ref]);
      const dataContrato = dataExtensoISO(corrido) || dataISO((corrido.match(/[A-Za-zÀ-ú]+\/[A-Z]{2},\s*(\d{2}\/\d{2}\/\d{4})/) || [])[1]);
      if (ass && dataContrato && ass !== dataContrato) add('atencao', 'Data do contrato diferente da data de assinatura na ficha', `Contrato: ${BR(dataContrato)} · ficha: ${BR(ass)}.`, [ficha.ref, ...contrato.map(p => p.ref)]);
    }

    // 9. Preâmbulo: profissão do sócio (Manual de LTDA, item 3, I, "d"; exigência 9.1.1)
    if (textoContrato) {
      const quals = [...corrido.matchAll(/(brasileir[oa]|estrangeir[oa])\s*,\s*(solteir[oa]|casad[oa]|divorciad[oa]|vi[uú]v[oa]|separad[oa])([^.]*?)(nascid[oa]|portador|inscrit[oa]|residente)/gi)];
      const semProf = quals.filter(q => !norm(q[3].replace(/em uni[aã]o est[aá]vel|sob o regime de [^,]+/gi, '')).length);
      if (semProf.length) add('erro', 'Qualificação do sócio sem profissão',
        `${semProf.length} qualificação(ões) sem profissão no contrato. O Manual de Registro de LTADA (item 3) exige a profissão; é a exigência 9.1.1. Ex.: "…solteiro, empresário, nascido em…".`.replace('LTADA', 'LTDA'),
        contrato.map(p => p.ref));
      else if (quals.length) add('ok', 'Qualificação do sócio com profissão', '', []);
    }

    // 10. Transformação de ex-MEI: desenquadramento do SIMEI anexado
    const transf = paginas.some(p => /utiliza[cç][aã]o de acervo|transfer[eê]ncia de seu acervo|Transformar o registro de Empres[aá]rio Individual/i.test(p.texto));
    if (transf) {
      if (!paginas.some(p => /SIMEI|desenquadramento/i.test(p.texto)))
        add('atencao', 'Transformação sem cópia do desenquadramento do SIMEI',
          'Se a empresa era MEI, anexe a cópia do desenquadramento do SIMEI (Manual de Registro de Empresário Individual). Se nunca foi MEI, ignore.', []);
      if (textoContrato && !/na qualidade de empres[aá]rio individual/i.test(corrido))
        add('erro', 'Contrato não qualifica a empresa individual no preâmbulo',
          'Exigência já recebida da JUCESP: "qualificar a empresa individual no preâmbulo do instrumento e transformar para LTDA". Use o modelo de transformação do portal.', contrato.map(p => p.ref));
    }

    // 11. Assinatura eletrônica
    const ass = doTipo('assinaturas');
    if (ass.length) {
      add('ok', 'Relatório de assinaturas eletrônicas presente', 'Confira no link de validação quem assinou e com qual certificado.', ass.map(p => p.ref));
      if (paginas.some(p => /e-CNPJ/i.test(p.texto))) add('atencao', 'Assinatura com certificado e-CNPJ',
        'O sócio assina como pessoa física: prefira o e-CPF ou o gov.br. Confirme com a JUCESP se o e-CNPJ é aceito.', ass.map(p => p.ref));
    } else if (paginas.length) add('info', 'Sem relatório de assinatura eletrônica', 'Normal antes de assinar. Depois de assinado, confira o QR Code/hash de validação (exigência 29.1).', []);

    // Documentos encontrados
    const documentos = paginas.reduce((acc, p) => {
      const ult = acc[acc.length - 1];
      if (ult && ult.tipo === p.tipo && ult.arquivo === p.arquivo && p.tipo !== 'capa') ult.paginas.push(p.numero);
      else acc.push({ tipo: p.tipo, nome: NOMES_DOC[p.tipo], arquivo: p.arquivo, paginas: [p.numero] });
      return acc;
    }, []);
    const ordem = { erro: 0, atencao: 1, info: 2, ok: 3 };
    achados.sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);
    return { documentos, capas, achados };
  }

  // Regras em uso (exibidas na tela, para a equipe saber o que é conferido)
  const REGRAS = [
    'Ato de cancelamento com transferência de acervo: capa e requerimento com os dados da empresa individual',
    'Nome do sócio escrito igual em todos os documentos',
    'CPFs válidos',
    'Logradouro e bairro com a mesma grafia em todos os documentos',
    'Objeto e CNAEs da ficha cadastral iguais aos do contrato',
    'Capital igual na ficha e no contrato',
    'Data de início e data de assinatura coerentes',
    'Profissão na qualificação do sócio (Manual de LTDA, item 3)',
    'Transformação: empresa individual qualificada no preâmbulo e desenquadramento do SIMEI anexado',
    'Capas com a mesma data; reentrada com formulário de exigência',
    'Assinatura eletrônica com relatório de validação; alerta para e-CNPJ',
  ];

  const api = { linhasDePagina, campo, classificar, analisar, variantes, cpfValido, sim, norm, REGRAS, NOMES_DOC };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Conferidor = api;
})(typeof window !== 'undefined' ? window : globalThis);
