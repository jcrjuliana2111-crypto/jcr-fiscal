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
  // Rótulos são buscados em maiúsculas e como palavra inteira, de preferência nas linhas marcadas
  // como rótulo (para "PORTE" não casar com "Empresa de Pequeno Porte" no texto de um ato).
  function campo(texto, rotulo) {
    const linhas = texto.split('\n');
    const alvo = semAcento(rotulo).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const reRotulo = new RegExp('(^|[^A-Z])' + alvo + '(?![A-Z])');
    const ordem = linhas.map((l, i) => i).filter(i => i < linhas.length - 1)
      .sort((a, b) => (linhas[b].startsWith(ROTULO) ? 1 : 0) - (linhas[a].startsWith(ROTULO) ? 1 : 0) || a - b);
    for (const i of ordem) {
      const achou = reRotulo.exec(semAcento(linhas[i]));
      if (!achou) continue;
      const pos = achou.index + achou[1].length;
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
    // relatório do assinador (Autentique, ZapSign…): só a página do relatório, não o rodapé das demais
    ['assinaturas', /Relat[oó]rio de (auditoria|Assinaturas)/i],
    ['contrato', /Cl[aá]usula\s+(Primeira|Segunda|Terceira|\d)|^\s*(\S+\s+)?(DISTRATO|INSTRUMENTO PARTICULAR|EXTIN[CÇ][AÃ]O|ALTERA[CÇ][AÃ]O|CONTRATO SOCIAL)\b/im],
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

  // ── tipo de processo ──
  // Identificado pelos atos das capas, do requerimento de empresário, da ficha cadastral e pelo título do instrumento
  // (nunca pela lista de exigências, que cita todos os atos).
  const ATOS = [
    ['transformacao', /utiliza[cç][aã]o de acervo|transfer[eê]ncia de seu acervo|transforma/i],
    ['extincao', /extin[cç][aã]o|distrato|dissolu[cç][aã]o|liquida[cç][aã]o|encerramento/i],
    ['constituicao', /constitui[cç][aã]o|constitu[ií]da|inscri[cç][aã]o de empres[aá]rio|abertura de matriz/i],
    ['alteracao', /altera[cç][aã]o|entrada de s[oó]cio|sa[ií]da de s[oó]cio|admiss[aã]o|retirada|cess[aã]o|consolida[cç][aã]o|transfer[eê]ncia de sede/i],
    ['enquadramento', /(re|des)?enquadramento/i],
  ];
  const NOMES_PROC = { constituicao: 'Abertura (constituição/inscrição)', alteracao: 'Alteração', transformacao: 'Transformação',
    extincao: 'Encerramento (distrato/extinção)', enquadramento: 'Enquadramento ME/EPP' };

  function detectarProcesso(paginas, capas) {
    const atos = [];
    capas.forEach(c => atos.push(c.ato));
    paginas.filter(p => p.tipo === 'requerimento_empresario').forEach(p => atos.push(campo(p.texto, 'ATO(S)') || ''));
    paginas.filter(p => p.tipo === 'ficha').forEach(p => atos.push(campo(p.texto, 'ATOS') || ''));
    const contrato = paginas.filter(p => p.tipo === 'contrato');
    const titulo = contrato.length ? contrato[0].texto.split('\n').slice(0, 6).join(' ') : '';
    const tipos = new Set();
    atos.filter(Boolean).forEach(a => {
      if (ATOS[0][1].test(a)) { tipos.add('transformacao'); return; }
      ATOS.slice(1).forEach(([t, re]) => { if (re.test(a)) tipos.add(t); });
    });
    if (/TRANSFORMA[CÇ][AÃ]O/i.test(titulo)) tipos.add('transformacao');
    else if (/DISTRATO|EXTIN[CÇ][AÃ]O/i.test(titulo)) tipos.add('extincao');
    else if (/ALTERA[CÇ][AÃ]O/i.test(titulo)) tipos.add('alteracao');
    else if (/CONTRATO SOCIAL|INSTRUMENTO DE INSCRI/i.test(titulo)) tipos.add('constituicao');
    if (tipos.has('transformacao')) { tipos.delete('alteracao'); tipos.delete('extincao'); tipos.delete('constituicao'); }
    const texto = paginas.filter(p => p.tipo !== 'exigencias').map(p => p.texto).join('\n');
    const ltda = /\bLTDA\b|LIMITADA|Sociedade Limitada|\bs[oó]cio/i.test(texto);
    const ei = paginas.some(p => p.tipo === 'requerimento_empresario') || /empres[aá]rio individual/i.test(texto);
    return { tipos, natureza: tipos.has('transformacao') ? 'ei-ltda' : ltda ? 'ltda' : ei ? 'ei' : '?', atos: atos.filter(Boolean) };
  }

  // Documentos que cada tipo de processo costuma levar na JUCESP
  function esperados(processo) {
    const e = [];
    const t = processo.tipos, n = processo.natureza;
    if (t.has('transformacao')) e.push(['capa', 'Capas dos atos'], ['requerimento_empresario', 'Requerimento de empresário (cancelamento)'], ['ficha', 'Ficha cadastral da LTDA'], ['contrato', 'Instrumento de transformação']);
    if (t.has('constituicao') && n !== 'ei') e.push(['capa', 'Capa do requerimento'], ['ficha', 'Ficha cadastral'], ['quadro', 'Quadro societário'], ['contrato', 'Contrato social']);
    if (t.has('constituicao') && n === 'ei') e.push(['capa', 'Capa do requerimento'], ['requerimento_empresario', 'Requerimento de empresário']);
    if (t.has('alteracao') && n !== 'ei') e.push(['capa', 'Capa do requerimento'], ['contrato', 'Alteração contratual']);
    if (t.has('alteracao') && n === 'ei') e.push(['capa', 'Capa do requerimento'], ['requerimento_empresario', 'Requerimento de empresário']);
    if (t.has('extincao') && n !== 'ei') e.push(['capa', 'Capa do requerimento'], ['contrato', 'Distrato social']);
    if (t.has('extincao') && n === 'ei') e.push(['capa', 'Capa do requerimento'], ['contrato', 'Instrumento de extinção ou requerimento']);
    if (t.has('enquadramento')) e.push(['enquadramento', 'Declaração de enquadramento']);
    const vistos = new Set();
    return e.filter(([k]) => !vistos.has(k) && vistos.add(k));
  }

  // Palavras que o instrumento precisa conter para cada ato declarado na capa
  const ATO_NO_INSTRUMENTO = [
    [/nome empresarial|denomina[cç][aã]o/i, /nome empresarial|denomina[cç][aã]o/i, 'nome empresarial'],
    [/endere[cç]o|\bsede\b/i, /\bsede\b|endere[cç]o/i, 'endereço da sede'],
    [/objeto|atividade/i, /objeto/i, 'objeto social'],
    [/capital/i, /capital social/i, 'capital social'],
    [/entrada|admiss|sa[ií]da|retirada|cess[aã]o|transfer[eê]ncia de quotas/i, /quotas/i, 'quadro de sócios/quotas'],
    [/administra/i, /administra/i, 'administração'],
    [/consolida/i, /consolida/i, 'consolidação'],
  ];

  function regrasPorTipo({ processo, paginas, capas, contrato, corrido, ficha, doTipo, add }) {
    const t = processo.tipos, ltda = processo.natureza !== 'ei';
    const refs = contrato.map(p => p.ref);
    const tem = re => re.test(corrido);
    const nomes = [...t].map(k => NOMES_PROC[k]).join(' + ');
    if (!t.size) { add('atencao', 'Tipo de processo não identificado', 'Não encontrei o ato nas capas, no requerimento nem no título do instrumento. As regras gerais foram aplicadas; inclua a capa do requerimento para a conferência completa.', []); return; }
    add('info', `Processo identificado: ${nomes}`, processo.atos.length ? 'Atos: ' + [...new Set(processo.atos)].join(' · ') : '', []);

    // documentos esperados
    const faltam = esperados(processo).filter(([k]) => !doTipo(k).length && !(k === 'desimpedimento' && tem(/n[aã]o est[aá] impedido/i)));
    if (faltam.length) add('atencao', 'Documentos esperados que não vieram', faltam.map(([, n]) => n).join(', ') + '. Se já foram entregues em outro arquivo, inclua aqui para a conferência completa.', []);

    // ── constituição (LTDA) ──
    if (t.has('constituicao') && ltda && contrato.length) {
      const clausulas = [
        [/nome empresarial|denomina[cç][aã]o/i, 'nome empresarial'], [/\bsede\b/i, 'sede'], [/objeto/i, 'objeto social'],
        [/capital social/i, 'capital social'], [/quotas/i, 'quotas de cada sócio'], [/integraliza/i, 'forma e prazo de integralização'],
        [/administra/i, 'administração'], [/lucros (e|ou) (as |os )?(perdas|preju[ií]zos)|\bperdas\b|preju[ií]zos|resultados?\b(?! econ)/i, 'participação nos lucros e perdas'], [/\bforo\b|arbitra/i, 'foro ou cláusula arbitral'],
      ].filter(([re]) => !tem(re)).map(([, n]) => n);
      if (clausulas.length) add('erro', 'Contrato social sem cláusula obrigatória', `Não encontrei: ${clausulas.join(', ')}. (Manual de LTDA, item 4; exigência 8.2.)`, refs);
      else add('ok', 'Cláusulas obrigatórias do contrato social presentes', '', []);
      if (tem(/lucros futuros/i)) add('erro', 'Integralização com lucros futuros', 'É vedado integralizar o capital com lucros futuros (Manual de LTDA, item 4.3.3; exigência 15.11).', refs);
    }
    // nome empresarial de LTDA
    if ((t.has('constituicao') || t.has('transformacao')) && ltda) {
      capas.filter(c => !/cancelamento/i.test(c.ato) && c.nome && !/\b(LTDA|LIMITADA)\.?$/i.test(c.nome.trim()))
        .forEach(c => add('erro', `Capa ${c.seq}: nome empresarial sem "LTDA"`, `"${c.nome}". O nome da sociedade limitada termina com LTDA ou Limitada (exigência 13.1).`, [c.ref]));
    }
    // desimpedimento do administrador (constituição, transformação e alteração com administrador)
    const precisaDesimp = t.has('constituicao') || t.has('transformacao') || (t.has('alteracao') && processo.atos.some(a => /administra/i.test(a)));
    if (precisaDesimp && ltda && contrato.length) {
      if (!tem(/n[aã]o est[aá] impedid/i) && !doTipo('desimpedimento').length)
        add('erro', 'Falta a declaração de desimpedimento do administrador', 'Inclua a cláusula no instrumento ou a declaração em separado (Código Civil, art. 1.011, § 1º; exigência 11.3).', refs);
    }
    // visto de advogado: dispensado para ME/EPP
    if ((t.has('constituicao') || t.has('transformacao')) && ltda && contrato.length) {
      const portes = capas.map(c => c.porte).filter(Boolean).filter(p => !/cancelamento/i.test(p));
      const naoMe = portes.length && portes.every(p => !/^(ME|EPP)$/i.test(p.trim())) && !tem(/microempresa|pequeno porte/i);
      if (naoMe && !tem(/\bOAB\b/i)) add('atencao', 'Sem visto de advogado', 'Empresa que não é ME/EPP precisa do visto de advogado com nome e número da OAB no contrato social (exigência 8.1).', refs);
    }
    // enquadramento ME/EPP declarado
    const porteMe = capas.some(c => /^(ME|EPP)$/i.test((c.porte || '').trim()) && !/cancelamento/i.test(c.ato));
    if ((t.has('constituicao') || t.has('transformacao') || t.has('enquadramento')) && porteMe && !doTipo('enquadramento').length && !tem(/enquadra/i))
      add('erro', 'Porte ME/EPP sem declaração de enquadramento', 'Junte a declaração ou inclua a cláusula de enquadramento (LC 123/2006, art. 3º; exigência 17.1).', capas.map(c => c.ref));
    doTipo('enquadramento').forEach(p => {
      const decl = /PEQUENO PORTE/i.test(p.texto) ? 'EPP' : /MICROEMPRESA/i.test(p.texto) ? 'ME' : null;
      const diverg = capas.filter(c => decl && /^(ME|EPP)$/i.test((c.porte || '').trim()) && c.porte.trim().toUpperCase() !== decl && !/cancelamento/i.test(c.ato));
      if (diverg.length) add('erro', 'Porte da capa diferente da declaração de enquadramento', `Declaração: ${decl}; capa ${diverg.map(c => `${c.seq}: ${c.porte}`).join(', ')} (exigência 17.2).`, [p.ref, ...diverg.map(c => c.ref)]);
    });
    // sócios do quadro societário qualificados no instrumento
    if (contrato.length && ltda) {
      doTipo('quadro').forEach(p => {
        const nome = campo(p.texto, 'NOME DO INTEGRANTE');
        if (nome && !norm(corrido).includes(norm(nome))) add('erro', `Sócio do quadro societário não aparece no instrumento: ${nome}`,
          'Todo sócio do quadro deve estar qualificado no preâmbulo e assinar (Manual de LTDA, item 3; exigência 9.1.1).', [p.ref, ...refs]);
      });
    }

    // ── alteração ──
    if (t.has('alteracao') && contrato.length) {
      if (ltda) {
        if (!tem(/altera[cç][aã]o contratual|altera[cç][aã]o do contrato|altera[cç][aã]o do instrumento/i))
          add('atencao', 'Título da alteração não encontrado', 'O instrumento deve ter título "Alteração Contratual" (ou equivalente), de preferência com o número da alteração (Manual de LTDA, Seção IV, item 3).', refs);
        if (!tem(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/)) add('erro', 'Alteração sem o CNPJ da sociedade no preâmbulo',
          'O preâmbulo deve qualificar a sociedade com nome empresarial, CNPJ e endereço (Manual de LTDA, Seção IV, item 3, II, "b"; exigência 23.6).', refs);
        if (!tem(/resolve/i)) add('atencao', 'Não encontrei a resolução de alterar', 'O preâmbulo deve conter a resolução dos sócios de promover a alteração ("resolvem alterar…").', refs);
      }
      // cada ato declarado na capa precisa aparecer no instrumento
      const atosAlt = processo.atos.filter(a => ATOS[3][1].test(a));
      ATO_NO_INSTRUMENTO.forEach(([reAto, reInstr, nome]) => {
        if (atosAlt.some(a => reAto.test(a)) && !tem(reInstr))
          add('erro', `Ato de ${nome} declarado sem cláusula correspondente`, `A capa/ficha declara alteração de ${nome}, mas o instrumento não trata disso (exigências 8.3 e 23.6).`, [...capas.map(c => c.ref), ...refs]);
      });
      if (processo.atos.some(a => /outra (UF|unidade)|reativa/i.test(a)) && !tem(/consolida/i))
        add('erro', 'Falta a consolidação do contrato', 'Transferência de sede para outra UF e reativação exigem o contrato consolidado (Manual de LTDA, Seção IV, item 3, III, "d"; exigência 8.7).', refs);
      else if (ltda && !tem(/consolida/i)) add('info', 'Alteração sem consolidação', 'A consolidação é opcional, mas obrigatória na primeira alteração depois de cessão de quotas por instrumento separado.', refs);
    }

    // ── encerramento ──
    if (t.has('extincao') && contrato.length) {
      if (ltda) {
        const falta = [
          [/distrato|dissolu[cç][aã]o|extin/i, 'título e resolução do distrato'],
          [/repartid|restitu|n[aã]o h[aá] bens|haveres/i, 'importância repartida entre os sócios ou declaração de que não há bens a restituir'],
          [/ativo e (o )?passivo/i, 'quem assume o ativo e o passivo remanescentes'],
          [/guarda dos livros|livros/i, 'responsável pela guarda dos livros'],
        ].filter(([re]) => !tem(re)).map(([, n]) => n);
        if (falta.length) add('erro', 'Distrato sem elemento obrigatório', `Não encontrei: ${falta.join('; ')}. (Exigência 26.1; Manual de LTDA, Seção V.)`, refs);
        else add('ok', 'Elementos obrigatórios do distrato presentes', 'Confira se todos os sócios assinam (exigência 26.2).', []);
      } else {
        const falta = [
          [/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/, 'CNPJ da empresa'],
          [/extin|encerra/i, 'resolução de extinguir/encerrar a empresa'],
        ].filter(([re]) => !tem(re)).map(([, n]) => n);
        if (falta.length) add('erro', 'Instrumento de extinção incompleto', `Não encontrei: ${falta.join('; ')}. O preâmbulo deve qualificar o empresário e a empresa (nome empresarial, endereço e CNPJ) e conter a resolução de encerrar (Manual de EI, Seção III, item 2).`, refs);
      }
    }

    // ── transformação: os dois atos juntos ──
    if (t.has('transformacao') && capas.length) {
      const cancel = capas.some(c => /cancelamento/i.test(c.ato)) || doTipo('requerimento_empresario').length;
      const constit = capas.some(c => /acervo da/i.test(c.ato) || /constitu/i.test(c.ato));
      if (!cancel || !constit) add('atencao', 'Transformação sem um dos atos', `${!cancel ? 'Falta o cancelamento do empresário individual. ' : ''}${!constit ? 'Falta a constituição da LTDA por utilização de acervo. ' : ''}Os dois atos tramitam juntos (Manual de LTDA, item 4.3.2; Manual de EI, Seção III, item 4).`, capas.map(c => c.ref));
    }

    // ── empresário individual: requerimento completo ──
    if (processo.natureza === 'ei' && (t.has('constituicao') || t.has('alteracao'))) {
      doTipo('requerimento_empresario').forEach(p => {
        const vazios = [['NOME DO EMPRESÁRIO', 'nome do empresário'], ['ESTADO CIVIL', 'estado civil'], ['CPF', 'CPF'], ['NOME EMPRESARIAL', 'nome empresarial'],
          ['VALOR DO CAPITAL (R$)', 'capital'], ['DOMICILIADO NA', 'endereço do empresário']]
          .filter(([r]) => campo(p.texto, r) === '').map(([, n]) => n);
        if (vazios.length) add('erro', 'Requerimento de empresário incompleto', `Campos vazios: ${vazios.join(', ')} (Manual de EI, item 3).`, [p.ref]);
        if (/casad/i.test(campo(p.texto, 'ESTADO CIVIL') || '') && !campo(p.texto, 'REGIME DE BENS'))
          add('erro', 'Empresário casado sem regime de bens', 'Informe o regime de bens (Manual de EI, item 3, IV).', [p.ref]);
      });
    }
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

    const processo = detectarProcesso(paginas, capas);

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
      if (ini && ass && ini < ass && (processo.tipos.has('constituicao') || processo.tipos.has('transformacao'))) add(processo.tipos.has('transformacao') ? 'info' : 'erro', 'Data de início das atividades anterior à assinatura',
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
    const transf = processo.tipos.has('transformacao');
    if (transf) {
      if (!paginas.some(p => /SIMEI|desenquadramento/i.test(p.texto)))
        add('atencao', 'Transformação sem cópia do desenquadramento do SIMEI',
          'Se a empresa era MEI, anexe a cópia do desenquadramento do SIMEI (Manual de Registro de Empresário Individual). Se nunca foi MEI, ignore.', []);
      if (textoContrato && !/na qualidade de empres[aá]rio individual/i.test(corrido))
        add('erro', 'Contrato não qualifica a empresa individual no preâmbulo',
          'Exigência já recebida da JUCESP: "qualificar a empresa individual no preâmbulo do instrumento e transformar para LTDA". Use o modelo de transformação do portal.', contrato.map(p => p.ref));
    }

    regrasPorTipo({ processo, paginas, capas, contrato, corrido, ficha, doTipo, add });

    // 12. Texto do instrumento: caracteres trocados e declaração de enquadramento invertida
    if (textoContrato) {
      const trocados = [...new Set((corrido.match(/\b[a-zà-ú]{2,}[0-9]+[a-zà-ú]{2,}\b|\b[a-zà-ú]+;[a-zà-ú]+\b/gi) || []))];
      if (trocados.length) add('erro', 'Instrumento com caracteres trocados',
        `Palavras com números ou ";" no meio, típicas de PDF convertido ou digitalizado: ${trocados.slice(0, 12).join(', ')}${trocados.length > 12 ? '…' : ''}. Redigite o instrumento a partir de um arquivo de texto (exigência 8.3).`, contrato.map(p => p.ref));
      if (/se enquadra em (qualquer|alguma|uma) (das )?hip[oó]teses? de exclus/i.test(corrido))
        add('erro', 'Declaração de enquadramento invertida', 'O texto diz que a empresa "se enquadra" em hipótese de exclusão da LC 123. O correto é "não se enquadra em nenhuma das hipóteses de exclusão" (exigência 17.2).', contrato.map(p => p.ref));
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
    return { documentos, capas, achados, processo: { ...processo, tipos: [...processo.tipos] } };
  }

  // Regras em uso (exibidas na tela, para a equipe saber o que é conferido)
  const REGRAS = [
    'Identifica o processo (abertura, alteração, transformação, encerramento, enquadramento; LTDA ou empresário individual) e os documentos esperados',
    'Todos os atos: nome do sócio igual em todas as páginas, CPFs válidos, logradouro e bairro com a mesma grafia, objeto/CNAEs e capital da ficha iguais aos do instrumento, profissão na qualificação, datas das capas, texto sem caracteres trocados',
    'Abertura (LTDA): cláusulas obrigatórias, nome com LTDA, integralização sem lucros futuros, desimpedimento, enquadramento ME/EPP, visto de advogado quando não é ME/EPP, data de início não anterior à assinatura, sócios do quadro qualificados no contrato',
    'Abertura/alteração (empresário individual): requerimento com nome, estado civil, regime de bens se casado, CPF, endereço, nome empresarial e capital',
    'Alteração: título, CNPJ da sociedade no preâmbulo, resolução de alterar, cada ato da capa com cláusula correspondente, consolidação quando obrigatória, desimpedimento de novo administrador',
    'Transformação: cancelamento do empresário com os dados dele, constituição por acervo junto, empresa individual qualificada no preâmbulo, desenquadramento do SIMEI',
    'Encerramento: distrato com resolução, bens repartidos ou declaração de que não há, ativo e passivo remanescentes e guarda dos livros; extinção de empresário com CNPJ e resolução',
    'Enquadramento: declaração presente e porte igual ao da capa; cláusula sem "se enquadra" em hipótese de exclusão',
    'Reentrada com formulário de exigência; assinatura eletrônica com relatório de validação e alerta para e-CNPJ',
  ];

  const api = { linhasDePagina, campo, classificar, analisar, variantes, cpfValido, sim, norm, REGRAS, NOMES_DOC };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Conferidor = api;
})(typeof window !== 'undefined' ? window : globalThis);
