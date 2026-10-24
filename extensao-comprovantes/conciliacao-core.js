// Motor de conciliação bancária: lê extrato (OFX/CSV) e casa cada
// movimento com uma parcela em aberto do Conta Azul.
// Funções puras — usadas pela página conciliacao.html e pelos testes.
(function (root) {
  'use strict';

  // --- utilitários ---
  function parseValorBR(s) {
    if (typeof s === 'number') return s;
    s = String(s || '').trim().replace(/[R$\s]/g, '');
    if (!s) return NaN;
    const neg = /^\(.*\)$/.test(s) || /-$/.test(s) || /D$/i.test(s);
    s = s.replace(/[()]/g, '').replace(/[-+]$/, '').replace(/[CD]$/i, '');
    // "1.234,56" → 1234.56 ; "1234.56" → 1234.56
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    const v = parseFloat(s);
    return neg ? -Math.abs(v) : v;
  }

  function parseData(s) {
    s = String(s || '').trim();
    let m = s.match(/^(\d{4})(\d{2})(\d{2})/); // OFX 20260131...
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (m) {
      const y = m[3].length === 2 ? '20' + m[3] : m[3];
      return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    }
    return '';
  }

  function diasEntre(a, b) {
    return Math.round(Math.abs(new Date(a + 'T00:00:00Z') - new Date(b + 'T00:00:00Z')) / 86400000);
  }

  const STOP = new Set(['de', 'da', 'do', 'dos', 'das', 'e', 'ltda', 'me', 'epp', 'sa', 'eireli',
    'pix', 'ted', 'doc', 'transf', 'transferencia', 'pagamento', 'pagto', 'pgto', 'recebido',
    'enviado', 'boleto', 'tit', 'titulo', 'cobranca', 'liquidacao', 'credito', 'debito', 'conta']);

  function tokens(s) {
    return String(s || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/).filter(t => t.length >= 3 && !STOP.has(t) && !/^\d+$/.test(t));
  }

  // fração dos tokens do nome do contato que aparecem no histórico do banco
  function similaridadeNome(historico, nome) {
    const tn = tokens(nome);
    if (!tn.length) return 0;
    const th = new Set(tokens(historico));
    return tn.filter(t => th.has(t)).length / tn.length;
  }

  // --- leitura de extratos ---
  function parseOFX(texto) {
    const out = [];
    const blocos = String(texto).split(/<STMTTRN>/i).slice(1);
    for (const b of blocos) {
      const tag = n => {
        const m = b.match(new RegExp('<' + n + '>([^<\\r\\n]*)', 'i'));
        return m ? m[1].trim() : '';
      };
      const valor = parseValorBR(tag('TRNAMT').replace(',', '.'));
      const data = parseData(tag('DTPOSTED'));
      if (!data || isNaN(valor)) continue;
      out.push({
        id: tag('FITID') || `${data}|${valor}|${out.length}`,
        data, valor,
        historico: [tag('NAME'), tag('MEMO')].filter(Boolean).join(' ')
      });
    }
    return out;
  }

  function splitCSVLinha(linha, sep) {
    const cols = []; let cur = ''; let q = false;
    for (let i = 0; i < linha.length; i++) {
      const c = linha[i];
      if (c === '"') { if (q && linha[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (c === sep && !q) { cols.push(cur); cur = ''; }
      else cur += c;
    }
    cols.push(cur);
    return cols.map(s => s.trim());
  }

  // CSV com cabeçalho contendo colunas de data, valor e histórico/descrição.
  // Aceita também colunas separadas de crédito e débito.
  function parseCSV(texto) {
    const linhas = String(texto).replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
    if (!linhas.length) return [];
    const sep = (linhas[0].match(/;/g) || []).length >= (linhas[0].match(/,/g) || []).length ? ';' : ',';
    const head = splitCSVLinha(linhas[0], sep).map(h =>
      h.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim());
    const idx = re => head.findIndex(h => re.test(h));
    const iData = idx(/data/);
    const iValor = idx(/^valor|valor$|^montante|^quantia/);
    const iCred = idx(/credito|entrada/);
    const iDeb = idx(/debito|saida/);
    const iHist = idx(/hist|descr|memo|lancamento|detalhe/);
    const iDoc = idx(/^doc|documento|^id$|identificador/);
    if (iData < 0 || (iValor < 0 && iCred < 0 && iDeb < 0)) {
      throw new Error('CSV precisa de colunas "Data" e "Valor" (ou "Crédito"/"Débito").');
    }
    const out = [];
    for (let n = 1; n < linhas.length; n++) {
      const c = splitCSVLinha(linhas[n], sep);
      const data = parseData(c[iData]);
      let valor;
      if (iValor >= 0) valor = parseValorBR(c[iValor]);
      else {
        const cr = parseValorBR(c[iCred]); const db = parseValorBR(c[iDeb]);
        valor = (!isNaN(cr) && cr) ? Math.abs(cr) : -Math.abs(db);
      }
      if (!data || isNaN(valor) || valor === 0) continue;
      out.push({
        id: (iDoc >= 0 && c[iDoc]) ? c[iDoc] : `${data}|${valor}|${n}`,
        data, valor,
        historico: iHist >= 0 ? c[iHist] : ''
      });
    }
    return out;
  }

  function parseExtrato(nomeArquivo, texto) {
    if (/\.ofx$/i.test(nomeArquivo) || /<OFX>/i.test(texto)) return parseOFX(texto);
    return parseCSV(texto);
  }

  // --- conciliação ---
  // Nome do favorecido/pagador quando o histórico é de PIX/TED/DOC/transferência
  // ("PIX ( DOC.: DEB PIX / ROGERIO LIMA DOS SANTOS )", "TED BETA SERVICOS").
  // Boletos, tarifas e débitos automáticos não trazem nome confiável → ''.
  const GENERICO = new Set(['deb', 'cred', 'env', 'rec', 'recebida', 'enviada', 'instantaneo', 'ib',
    'agendado', 'agend', 'mesma', 'titularidade', 'outra', 'outras', 'banco', 'agencia', 'qrcode', 'chave']);
  function nomeNoExtrato(historico) {
    const h = String(historico || '');
    if (!/\b(pix|ted|transf\w*|doc)\b/i.test(h)) return '';
    if (/liquida[cç]|t[ií]tulo|boleto|bloqueto|tarifa|\biof\b|juros|cesta|convenio|conv[eê]nio/i.test(h)) return '';
    const trecho = h.includes('/') ? h.slice(h.lastIndexOf('/') + 1) : h;
    const t = tokens(trecho).filter(x => !GENERICO.has(x));
    return t.length >= 2 ? t.join(' ') : '';
  }

  // O nome está mesmo no texto? Precisa de pelo menos DUAS palavras do nome em
  // comum (ex.: nome e sobrenome) e metade do nome; um sobrenome só ("Souza")
  // não basta. Nome de uma palavra só (ex.: "Energisa", "Alfa") precisa aparecer.
  function nomeForte(texto, nome) {
    const tn = [...new Set(tokens(nome))];
    if (!tn.length) return false;
    const th = new Set(tokens(texto));
    const c = tn.filter(t => th.has(t)).length;
    return tn.length === 1 ? c === 1 && tn[0].length >= 4 : c >= 2 && c / tn.length >= 0.5;
  }

  // palavras de formulário que não são nome de ninguém (comprovantes)
  const FORMULARIO = new Set(['favorecido', 'fornecedor', 'valor', 'tipo', 'comprovante', 'data', 'vencimento',
    'beneficiario', 'pagador', 'documento', 'agendamento', 'agencia', 'banco', 'codigo', 'autenticacao', 'pago',
    'enviada', 'transacao', 'descricao', 'chave', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set',
    'out', 'nov', 'dez', 'pdf', 'png', 'jpg', 'jpeg', 'para', 'id', 'via', 'instituicao', 'identificacao', 'cpf', 'cnpj']);
  // o comprovante traz algum nome (pessoa/empresa/descrição)?
  function temNome(texto) {
    return tokens(texto).filter(t => !FORMULARIO.has(t) && !/\d/.test(t)).length >= 2;
  }
  // palavras que o robô considera "nome" no comprovante (para mostrar na tela)
  function palavrasNome(texto) {
    return [...new Set(tokens(texto).filter(t => !FORMULARIO.has(t) && !/\d/.test(t)))];
  }

  // nome do extrato bate com o contato (ou, se permitido, com a descrição) do lançamento?
  function nomeBate(nomeExtrato, parcela, soContato) {
    return nomeForte(nomeExtrato, parcela.nome) || (!soContato && nomeForte(nomeExtrato, parcela.descricao));
  }

  // diferença entre o que caiu no banco e o valor da parcela:
  // a maior → juros (ou multa); a menor → desconto.
  function ajusteDe(movimento, parcela) {
    const dif = Math.round(Math.abs(movimento.valor) * 100) - Math.round(parcela.valor * 100);
    if (!dif) return null;
    return { tipo: dif > 0 ? 'juros' : 'desconto', valor: Math.abs(dif) / 100 };
  }

  // monta um par escolhido à mão na tela
  function montarPar(movimento, parcela) {
    return { movimento, parcela, dias: diasEntre(movimento.data, parcela.vencimento), similaridade: 0,
      score: 0, confianca: 'manual', ajuste: ajusteDe(movimento, parcela) };
  }

  // --- pagamento agrupado: 1 movimento do banco quita vários lançamentos ---
  // Ajuste (juros/desconto) da diferença vai para o maior lançamento do grupo.
  function montarGrupo(movimento, parcelas, confianca) {
    const ordem = [...parcelas].sort((a, b) => a.vencimento.localeCompare(b.vencimento) || b.valor - a.valor);
    const soma = ordem.reduce((t, p) => t + Math.round(p.valor * 100), 0);
    const dif = Math.round(Math.abs(movimento.valor) * 100) - soma;
    const maior = ordem.reduce((a, b) => (b.valor > a.valor ? b : a), ordem[0]);
    return {
      movimento, parcela: ordem[0], parcelas: ordem, grupo: true,
      dias: Math.max(...ordem.map(p => diasEntre(movimento.data, p.vencimento))),
      similaridade: 0, score: 0, confianca: confianca || 'manual',
      ajuste: dif ? { tipo: dif > 0 ? 'juros' : 'desconto', valor: Math.abs(dif) / 100 } : null,
      ajusteEm: dif ? maior.id : null
    };
  }

  // Combinações (2+ itens) cuja soma em centavos é exatamente `alvo`.
  // `itens` já vem limitado (até 16); para no máximo `limite` soluções.
  function combinacoesSoma(itens, alvo, limite) {
    const v = itens.map(p => Math.round(p.valor * 100));
    const idx = v.map((_, i) => i).sort((a, b) => v[b] - v[a]);
    const resto = []; // soma do que ainda pode entrar, para podar
    for (let k = idx.length - 1, acc = 0; k >= 0; k--) { acc += v[idx[k]]; resto[k] = acc; }
    const sols = [], atual = [];
    (function dfs(k, soma) {
      if (sols.length >= limite) return;
      if (soma === alvo) { if (atual.length >= 2) sols.push(atual.map(i => itens[i])); return; }
      if (k >= idx.length || soma + resto[k] < alvo) return;
      const i = idx[k];
      if (soma + v[i] <= alvo) { atual.push(i); dfs(k + 1, soma + v[i]); atual.pop(); }
      dfs(k + 1, soma);
    })(0, 0);
    return sols;
  }

  // Liga cada comprovante da pasta a um movimento do extrato (antes da conciliação):
  // valor do movimento entre os valores do comprovante e, se o comprovante tiver
  // data de pagamento, até `janelaDias` da data do banco. Comprovante sem data só
  // vale se for a única opção dos dois lados. Retorna { idMovimento: idComprovante }.
  function comprovantesDosMovimentos(movimentos, comprovantes, opts) {
    const janela = (opts && opts.janelaDias) != null ? opts.janelaDias : 3;
    const cand = [];
    for (const m of movimentos) {
      const cents = Math.round(Math.abs(m.valor) * 100);
      const nomeExt = nomeNoExtrato(m.historico);
      for (const c of comprovantes) {
        if (!c.valores || !c.valores.includes(cents)) continue;
        if (nomeExt && temNome(c.texto) && !nomeForte(c.texto, nomeExt)) continue; // banco e comprovante com nomes diferentes
        let dias = null;
        if (c.datas && c.datas.length) {
          dias = Math.min(...c.datas.map(d => diasEntre(m.data, d)));
          if (dias > janela) continue;
        }
        cand.push({ m: m.id, c: c.id, semData: dias == null, score: dias == null ? -janela - 1 : -dias });
      }
    }
    const nM = {}, nC = {};
    for (const x of cand) { nM[x.m] = (nM[x.m] || 0) + 1; nC[x.c] = (nC[x.c] || 0) + 1; }
    cand.sort((a, b) => b.score - a.score);
    const usadosM = new Set(), usadosC = new Set(), out = {};
    for (const x of cand) {
      if (usadosM.has(x.m) || usadosC.has(x.c)) continue;
      if (x.semData && (nM[x.m] > 1 || nC[x.c] > 1)) continue;
      usadosM.add(x.m); usadosC.add(x.c); out[x.m] = x.c;
    }
    return out;
  }

  // Para movimentos sem par: procura lançamentos do MESMO contato cuja soma bate
  // exatamente com o valor do banco. O fornecedor/cliente do banco TEM que bater
  // com o contato do Conta Azul: nome do PIX/TED, ou o nome que aparecer no
  // histórico (ex.: "PAG BOLETO F F DISTRIBUIDORA"). Quando o banco não mostra o
  // nome (boleto), vale o fornecedor do comprovante ligado ao movimento
  // (`m.textoComprovante`). Sem nenhum dos dois, não agrupa sozinho — fica para
  // montar à mão. Nunca vem com confiança alta.
  function agruparPagamentos(movimentos, parcelas, opts) {
    const janela = (opts && opts.janelaGrupo) != null ? opts.janelaGrupo : 31;
    const cand = [];
    for (const m of movimentos) {
      const tipo = m.valor > 0 ? 'receber' : 'pagar';
      const cents = Math.round(Math.abs(m.valor) * 100);
      const nomeExt = nomeNoExtrato(m.historico);
      const porContato = {};
      for (const p of parcelas) {
        if (p.tipo !== tipo || !(p.valor > 0) || Math.round(p.valor * 100) >= cents || rejeitado(opts, m, p)) continue;
        if (diasEntre(m.data, p.vencimento) > janela) continue;
        const k = tokens(p.nome).join(' ');
        if (!k) continue;
        (porContato[k] = porContato[k] || []).push(p);
      }
      const opcoes = [];
      for (const lista of Object.values(porContato)) {
        if (lista.length < 2) continue;
        const nome = (nomeExt ? nomeBate(nomeExt, lista[0], true)
          : nomeForte(m.historico, lista[0].nome) || (m.textoComprovante && nomeForte(m.textoComprovante, lista[0].nome))) ? 1 : 0;
        if (nome < 0.5) continue; // fornecedor do banco ≠ contato do Conta Azul
        const perto = lista.sort((a, b) => diasEntre(m.data, a.vencimento) - diasEntre(m.data, b.vencimento)).slice(0, 16);
        const sols = combinacoesSoma(perto, cents, 20);
        if (!sols.length) continue;
        const dias = s => Math.max(...s.map(p => diasEntre(m.data, p.vencimento)));
        sols.sort((a, b) => dias(a) - dias(b) || a.length - b.length);
        opcoes.push({ parcelas: sols[0], nome, unica: sols.length === 1, dias: dias(sols[0]) });
      }
      if (!opcoes.length) continue;
      opcoes.sort((a, b) => b.nome - a.nome || a.dias - b.dias);
      const o = opcoes[0];
      // mais de uma combinação possível no mesmo fornecedor → baixa (conferir quais notas)
      cand.push({ m, ...o, confianca: o.unica ? 'media' : 'baixa', score: (o.unica ? 100 : 0) + 20 * o.nome - o.dias });
    }
    cand.sort((a, b) => b.score - a.score);
    const usados = new Set(), grupos = [];
    for (const c of cand) {
      if (c.parcelas.some(p => usados.has(p.id))) continue;
      c.parcelas.forEach(p => usados.add(p.id));
      grupos.push({ ...montarGrupo(c.m, c.parcelas, c.confianca), similaridade: Math.round(c.nome * 100) / 100 });
    }
    return grupos;
  }

  // sugestões que a pessoa excluiu: opts.rejeitados = Set("idMovimento|idParcela")
  const rejeitado = (opts, m, p) => !!(opts && opts.rejeitados && opts.rejeitados.has(`${m.id}|${p.id}`));

  // movimentos: [{id, data, valor(+ entrada / - saída), historico}]
  // parcelas:   [{id, tipo:'receber'|'pagar', vencimento, valor, nome, descricao}]
  // Regras:
  //  1. valor igual (centavos), tipo compatível com o sinal e vencimento até
  //     `janelaDias` de distância;
  //  2. se o histórico traz nome (PIX/TED/DOC), ele PRECISA bater com o contato ou
  //     a descrição — senão vira só "possível" em semParcela, para vincular à mão;
  //  3. sem casamento exato: mesmo contato (nome ≥ 50%), diferença de até
  //     `margemAjuste` (15%) e até `janelaAjuste` (30) dias → sugestão com juros/desconto.
  // Cada parcela casa com no máximo um movimento.
  function conciliar(movimentos, parcelas, opts) {
    const janela = (opts && opts.janelaDias) != null ? opts.janelaDias : 5;
    const margem = (opts && opts.margemAjuste) != null ? opts.margemAjuste : 0.15;
    const janelaAjuste = Math.max(janela, (opts && opts.janelaAjuste) != null ? opts.janelaAjuste : 30);
    const cand = [], possiveis = {};
    for (const m of movimentos) {
      const tipo = m.valor > 0 ? 'receber' : 'pagar';
      const cents = Math.round(Math.abs(m.valor) * 100);
      const nomeExt = nomeNoExtrato(m.historico);
      for (const p of parcelas) {
        if (p.tipo !== tipo || Math.round(p.valor * 100) !== cents || rejeitado(opts, m, p)) continue;
        const dias = diasEntre(m.data, p.vencimento);
        if (dias > janela) continue;
        if (nomeExt && !nomeBate(nomeExt, p)) {
          (possiveis[m.id] = possiveis[m.id] || []).push({ parcela: p, dias, motivo: 'nome diferente' });
          continue;
        }
        const nome = Math.max(similaridadeNome(m.historico, p.nome), similaridadeNome(m.historico, p.descricao) * 0.8,
          nomeExt ? 1 : 0);
        const score = 60 + 20 * (1 - dias / (janela + 1)) + 20 * nome;
        cand.push({ m, p, dias, nome, score, nomeExt: !!nomeExt });
      }
    }
    cand.sort((a, b) => b.score - a.score);

    // quantos candidatos cada movimento/parcela tem (para medir ambiguidade)
    const nM = {}, nP = {};
    for (const c of cand) { nM[c.m.id] = (nM[c.m.id] || 0) + 1; nP[c.p.id] = (nP[c.p.id] || 0) + 1; }

    const usadosM = new Set(), usadosP = new Set(), pares = [];
    for (const c of cand) {
      if (usadosM.has(c.m.id) || usadosP.has(c.p.id)) continue;
      usadosM.add(c.m.id); usadosP.add(c.p.id);
      const unico = nM[c.m.id] === 1 && nP[c.p.id] === 1;
      // alta só com nome batendo; sem nome no extrato (boleto etc.) fica média para conferir
      let confianca = 'baixa';
      if (c.nome >= 0.5 && c.dias <= 3) confianca = 'alta';
      else if (c.nome >= 0.5 || (unico && c.dias <= 3)) confianca = 'media';
      pares.push({
        movimento: c.m, parcela: c.p, dias: c.dias,
        similaridade: Math.round(c.nome * 100) / 100,
        score: Math.round(c.score), confianca, ajuste: null
      });
    }

    // 3. juros / multa / desconto: mesmo contato, valor um pouco diferente
    const candAj = [];
    for (const m of movimentos) {
      if (usadosM.has(m.id)) continue;
      const tipo = m.valor > 0 ? 'receber' : 'pagar';
      const nomeExt = nomeNoExtrato(m.historico);
      for (const p of parcelas) {
        if (usadosP.has(p.id) || p.tipo !== tipo || !(p.valor > 0) || rejeitado(opts, m, p)) continue;
        const aj = ajusteDe(m, p);
        if (!aj || aj.valor > p.valor * margem) continue;
        const dias = diasEntre(m.data, p.vencimento);
        if (dias > janelaAjuste) continue;
        // valor diferente: só sugere juros/desconto se o banco mostra o MESMO fornecedor do Conta Azul
        const nome = (nomeExt ? nomeBate(nomeExt, p, true) : nomeForte(m.historico, p.nome)) ? 1 : 0;
        if (nome < 0.5) continue;
        candAj.push({ m, p, dias, nome, aj, score: nome * 50 - dias - 100 * aj.valor / p.valor });
      }
    }
    candAj.sort((a, b) => b.score - a.score);
    for (const c of candAj) {
      if (usadosM.has(c.m.id) || usadosP.has(c.p.id)) continue;
      usadosM.add(c.m.id); usadosP.add(c.p.id);
      pares.push({ movimento: c.m, parcela: c.p, dias: c.dias, similaridade: Math.round(c.nome * 100) / 100,
        score: Math.round(c.score), confianca: 'media', ajuste: c.aj });
    }

    // 4. pagamento agrupado: um movimento quita vários lançamentos do mesmo contato
    if (!(opts && opts.agrupar === false)) {
      const grupos = agruparPagamentos(movimentos.filter(m => !usadosM.has(m.id)), parcelas.filter(p => !usadosP.has(p.id)), opts);
      for (const g of grupos) {
        usadosM.add(g.movimento.id);
        g.parcelas.forEach(p => usadosP.add(p.id));
        pares.push(g);
      }
    }

    return {
      pares,
      semParcela: movimentos.filter(m => !usadosM.has(m.id))
        .map(m => possiveis[m.id] ? { ...m, possiveis: possiveis[m.id].filter(x => !usadosP.has(x.parcela.id)) } : m),
      parcelasSemMovimento: parcelas.filter(p => !usadosP.has(p.id))
    };
  }

  // Depois de ligar os comprovantes: se o comprovante traz o nome do contato,
  // a sugestão de confiança média (sem nome no extrato) sobe para alta.
  function reforcarComComprovantes(pares, vinculo, comprovantes) {
    const porId = Object.fromEntries(comprovantes.map(c => [c.id, c]));
    const subiram = [];
    for (const p of pares) {
      const c = porId[vinculo[p.movimento.id]];
      if (!c || p.grupo || p.confianca !== 'media' || p.ajuste || p.dias > 3) continue; // agrupado: sempre conferir
      if (nomeForte(c.texto, p.parcela.nome)) { p.confianca = 'alta'; subiram.push(p.movimento.id); }
    }
    return subiram;
  }

  // Extrai valores e datas de um comprovante sem IA: usa o texto do PDF
  // (quando houver) e o nome do arquivo. Formatos usados no escritório:
  //   PIX:        FAVORECIDO: NOME / VALOR R$ 490,00 / TIPO: PIX ENVIADO / DESCRIÇÃO (igual ao Conta Azul)
  //   Fornecedor: FORNECEDOR: NOME / VALOR: R$ 964,62 / VENCIMENTO: V 051026  (ddmmaa)
  // `vencimentos` são datas de vencimento (comparadas com o vencimento da
  // parcela); `datas` são datas de pagamento (comparadas com a data do banco).
  function dadosComprovante(texto, nomeArquivo) {
    const nome = String(nomeArquivo || '').replace(/\.[a-z0-9]+$/i, '');
    const fontes = [String(texto || ''), nome];
    const valores = new Set(), datas = new Set(), vencimentos = new Set();
    for (const f of fontes) {
      for (const m of f.matchAll(/(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2})(?!\d)/g)) valores.add(Math.round(parseValorBR(m[1]) * 100));
      // "V 051026", "V051026", "VENCIMENTO: V 05/10/26"
      for (const m of f.matchAll(/(?<![a-z])V\s*\.?\s*(\d{2})[/.-]?(\d{2})[/.-]?(\d{2}|\d{4})(?!\d)/gi)) {
        const d = parseData(`${m[1]}/${m[2]}/${m[3]}`); if (valido(d)) vencimentos.add(d);
      }
      // "Vencimento: 05/10/2026" / "Data de vencimento 05.10.26"
      for (const m of f.matchAll(/venc(?:imento)?[^\d\n]{0,15}(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?!\d)/gi)) {
        const d = parseData(`${m[1]}/${m[2]}/${m[3]}`); if (valido(d)) vencimentos.add(d);
      }
      const semVenc = f
        .replace(/venc(?:imento)?[^\d\n]{0,15}\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}(?!\d)/gi, ' ')
        .replace(/(?<![a-z])V\s*\.?\s*\d{2}[/.-]?\d{2}[/.-]?\d{2,4}(?!\d)/gi, ' ');
      for (const m of semVenc.matchAll(/(?<![\d/.-])(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?![\d/])/g)) {
        const d = parseData(`${m[1]}/${m[2]}/${m[3]}`); if (valido(d)) datas.add(d);
      }
      for (const m of semVenc.matchAll(/(?<!\d)(20\d{2})[-_.]?(\d{2})[-_.]?(\d{2})(?!\d)/g)) {
        const d = `${m[1]}-${m[2]}-${m[3]}`; if (valido(d)) datas.add(d);
      }
    }
    // no nome do arquivo aceita também ponto decimal: "ENEL 320.40.pdf"
    for (const m of nome.matchAll(/(?<![\d.])(\d+)[.](\d{2})(?![\d.])/g)) valores.add(Number(m[1]) * 100 + Number(m[2]));
    return {
      valores: [...valores].filter(v => v > 0), datas: [...datas], vencimentos: [...vencimentos],
      texto: fontes.join(' ')
    };
  }
  function valido(d) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
    return !!m && +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31 && +m[1] >= 2000;
  }

  // Liga comprovantes ({id, valores:[centavos], datas, vencimentos, texto}) às
  // sugestões de baixa. Regras:
  //  - o valor do movimento precisa estar entre os valores do comprovante;
  //  - se o comprovante tem vencimento, ele deve bater com o da parcela (±janela);
  //    se tem data de pagamento, ela deve estar a ±janela da data do banco;
  //  - nome (favorecido/fornecedor) e descrição iguais à do Conta Azul pontuam;
  //  - comprovante sem data e sem nome/descrição batendo só é aceito quando
  //    não há outra opção com o mesmo valor (evita trocar folhas de mesmo valor).
  // Retorna { idMovimento: idComprovante }.
  function casarComprovantes(pares, comprovantes, opts) {
    const janela = (opts && opts.janelaDias) != null ? opts.janelaDias : 3;
    const cand = [];
    for (const par of pares) {
      const cents = Math.round(Math.abs(par.movimento.valor) * 100);
      const nomeExt = nomeNoExtrato(par.movimento.historico);
      for (const c of comprovantes) {
        if (!c.valores.includes(cents)) continue;
        // comprovante com nome: tem que ser o do contato, o da descrição ou o do banco
        if (temNome(c.texto) && !(nomeForte(c.texto, par.parcela.nome) || nomeForte(c.texto, par.parcela.descricao) ||
          (nomeExt && nomeForte(c.texto, nomeExt)))) continue;
        const venc = c.vencimentos || [];
        let dias = null;
        if (venc.length) {
          if (!par.parcela.vencimento) continue;
          dias = Math.min(...venc.map(d => diasEntre(par.parcela.vencimento, d)));
          if (dias > janela) continue;
        }
        if (c.datas.length) {
          const dp = Math.min(...c.datas.map(d => diasEntre(par.movimento.data, d)));
          if (dp > janela && !venc.length) continue;
          if (dp <= janela) dias = dias == null ? dp : Math.min(dias, dp);
        }
        const nome = similaridadeNome(c.texto, par.parcela.nome);
        const desc = similaridadeNome(c.texto, par.parcela.descricao);
        cand.push({ m: par.movimento.id, c: c.id, semData: dias == null, fraco: dias == null && nome < 0.5 && desc < 0.5,
          score: 10 * nome + 10 * desc - (dias == null ? janela + 1 : dias) });
      }
    }
    const nM = {}, nC = {};
    for (const x of cand) { nM[x.m] = (nM[x.m] || 0) + 1; nC[x.c] = (nC[x.c] || 0) + 1; }
    cand.sort((a, b) => b.score - a.score);
    const usadosM = new Set(), usadosC = new Set(), out = {};
    for (const x of cand) {
      if (usadosM.has(x.m) || usadosC.has(x.c)) continue;
      if (x.fraco && (nM[x.m] > 1 || nC[x.c] > 1)) continue;
      usadosM.add(x.m); usadosC.add(x.c); out[x.m] = x.c;
    }
    return out;
  }

  // Resumo do fechamento em texto, para enviar ao cliente.
  // d = { cliente, conta, de, ate, movimentos, resultado, retornos, lancados, hoje }
  function resumoFechamento(d) {
    const brl = v => (v < 0 ? '-' : '') + 'R$ ' + Math.abs(Number(v)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const dt = s => s ? s.split('-').reverse().join('/') : '';
    const soma = l => l.reduce((s, x) => s + Math.abs(x), 0);
    const r = d.resultado, ret = d.retornos || {};
    const baixados = r.pares.filter(p => ret[p.movimento.id]?.status === 'ok');
    const lancados = d.lancados || [];
    const lancIds = new Set(lancados.map(x => x.movimento.id));
    const pend = r.semParcela.filter(m => !lancIds.has(m.id));
    const sugAbertas = r.pares.filter(p => ret[p.movimento.id]?.status !== 'ok');
    const hoje = d.hoje || new Date().toISOString().slice(0, 10);
    const atrasados = r.parcelasSemMovimento.filter(p => p.vencimento && p.vencimento < hoje);
    const L = [];
    L.push(`RESUMO DA CONCILIAÇÃO BANCÁRIA${d.cliente ? ' — ' + d.cliente : ''}`);
    if (d.conta) L.push(`Conta: ${d.conta}`);
    L.push(`Período do extrato: ${dt(d.de)} a ${dt(d.ate)}`);
    L.push('');
    L.push(`Movimentos no extrato: ${d.movimentos.length} (entradas ${brl(soma(d.movimentos.filter(m => m.valor > 0).map(m => m.valor)))}, saídas ${brl(soma(d.movimentos.filter(m => m.valor < 0).map(m => m.valor)))})`);
    L.push(`Baixados no Conta Azul: ${baixados.length} (${brl(soma(baixados.map(p => p.movimento.valor)))})`);
    const comAj = baixados.filter(p => p.ajuste);
    if (comAj.length) L.push(`  dos quais com juros/multa/desconto: ${comAj.length}`);
    if (lancados.length) L.push(`Lançados a partir do extrato (tarifas, juros etc.): ${lancados.length} (${brl(soma(lancados.map(x => x.movimento.valor)))})`);
    if (sugAbertas.length) L.push(`Sugestões ainda não baixadas: ${sugAbertas.length} (${brl(soma(sugAbertas.map(p => p.movimento.valor)))})`);
    L.push('');
    L.push(`PENDÊNCIAS — movimentos do banco sem lançamento: ${pend.length} (${brl(soma(pend.map(m => m.valor)))})`);
    for (const m of pend) L.push(`  ${dt(m.data)}  ${brl(m.valor).padStart(14)}  ${(m.valor < 0 ? 'saída ' : 'entrada')}  ${m.historico}`);
    L.push('');
    L.push(`LANÇAMENTOS EM ABERTO SEM MOVIMENTO NO BANCO: ${r.parcelasSemMovimento.length}`);
    if (atrasados.length) {
      L.push(`  Vencidos (antes de ${dt(hoje)}): ${atrasados.length} (${brl(soma(atrasados.map(p => p.valor)))})`);
      for (const p of atrasados) L.push(`  ${dt(p.vencimento)}  ${brl(p.valor).padStart(14)}  ${p.tipo === 'receber' ? 'a receber' : 'a pagar  '}  ${p.nome || ''}${p.descricao ? ' — ' + p.descricao : ''}`);
    }
    return L.join('\n');
  }

  // --- DDA (boletos registrados contra o CNPJ) ---
  // Linha digitável (47 dígitos) ou código de barras (44) de boleto bancário:
  // traz o fator de vencimento e o valor. Desde 22/02/2025 o fator recomeçou em
  // 1000 (base nova); boletos de convênio/concessionária (começam com 8) não têm isso.
  function dadosLinhaDigitavel(numeros) {
    const d = String(numeros || '').replace(/\D/g, '');
    let fator, valor;
    if (d.length === 47 && d[0] !== '8') { fator = d.slice(33, 37); valor = d.slice(37, 47); }
    else if (d.length === 44 && d[0] !== '8') { fator = d.slice(5, 9); valor = d.slice(9, 19); }
    else return null;
    const out = { valor: Number(valor) / 100, vencimento: '' };
    const f = Number(fator);
    if (f >= 1000) {
      const base = new Date(Date.UTC(2025, 1, 22));
      base.setUTCDate(base.getUTCDate() + f - 1000);
      out.vencimento = base.toISOString().slice(0, 10);
    }
    return out;
  }

  const RE_VALOR = /(?<![\d,.])\d{1,3}(?:\.\d{3})*,\d{2}(?![\d,])/g;
  const RE_DATA = /(?<![\d/])(\d{2})\/(\d{2})\/(\d{4}|\d{2})(?![\d/])/g;
  const RE_DOC = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2}/g;
  const RE_LINHA = /(?<![\d,.])\d[\d. ]{42,60}\d(?!\d)/g;
  const ROTULOS = /\b(benefici[aá]rio|cedente|sacador|pagador|cnpj|cpf|vencimento|venc|valor|documento|n[ºo°]|emiss[aã]o|data|linha digit[aá]vel|c[oó]digo de barras|situa[cç][aã]o|status|agendado|pendente|em aberto)\b:?/gi;

  function extrairCampos(txt) {
    const linhas = [];
    let resto = String(txt);
    for (const m of String(txt).matchAll(RE_LINHA)) {
      const dg = m[0].replace(/\D/g, '');
      if (dg.length !== 47 && dg.length !== 44) continue; // só tira do texto o que for linha digitável de verdade
      linhas.push(dg);
      resto = resto.replace(m[0], ' ');
    }
    const documento = (resto.match(RE_DOC) || [])[0] || '';
    resto = resto.replace(RE_DOC, ' ');
    const valores = [...resto.matchAll(RE_VALOR)].map(m => parseValorBR(m[0])).filter(v => v > 0);
    const datas = [...resto.matchAll(RE_DATA)].map(m => parseData(`${m[1]}/${m[2]}/${m[3]}`));
    const vencRotulo = resto.match(/venc[^\d\n]{0,20}(\d{2}\/\d{2}\/(?:\d{4}|\d{2}))/i);
    const nome = resto.replace(RE_VALOR, ' ').replace(RE_DATA, ' ').replace(/R\$/g, ' ').replace(ROTULOS, ' ')
      .replace(/[|;:]/g, ' ').replace(/\b\d+\b/g, ' ').replace(/\s+/g, ' ').trim();
    return { linhas, documento, valores, datas, vencRotulo: vencRotulo ? parseData(vencRotulo[1]) : '', nome };
  }

  function montarBoleto(c, i) {
    const ld = c.linhas.map(dadosLinhaDigitavel).find(Boolean);
    // vencimento: rotulado > linha digitável > a data mais tarde da linha (emissão vem antes)
    const vencimento = c.vencRotulo || (ld && ld.vencimento) || [...c.datas].sort().pop() || '';
    const valores = [...new Set([...(ld && ld.valor > 0 ? [ld.valor] : []), ...c.valores].map(v => Math.round(v * 100)))];
    if (!vencimento || !valores.length) return null;
    return {
      id: c.linhas[0] || `dda${i}|${vencimento}|${valores[0]}`,
      beneficiario: c.nome.slice(0, 120), documento: c.documento,
      vencimento, valor: valores[0] / 100, valores, linha: c.linhas[0] || ''
    };
  }

  // Lê o relatório de DDA a partir das linhas de texto do PDF (cada linha = itens
  // na mesma altura). Funciona com relatório em tabela (um boleto por linha) e em
  // blocos ("Beneficiário: … / Vencimento: … / Valor: …").
  function parseDDA(linhas) {
    linhas = (Array.isArray(linhas) ? linhas : String(linhas).split(/\r?\n/)).map(l => String(l).trim()).filter(Boolean);
    const inicioBloco = /^(benefici[aá]rio|cedente)\b\s*:?/i;
    const out = [];
    if (linhas.filter(l => inicioBloco.test(l)).length >= 2) {
      let bloco = null;
      const fechar = () => { if (bloco) { const b = montarBoleto(extrairCampos(bloco.join('\n')), out.length); if (b) out.push(b); } };
      for (const l of linhas) {
        if (inicioBloco.test(l)) { fechar(); bloco = [l]; } else if (bloco) bloco.push(l);
      }
      fechar();
    } else {
      let pendente = ''; // nome que ficou numa linha anterior sem valores
      for (const l of linhas) {
        const c = extrairCampos(l);
        const temBoleto = (c.valores.length && c.datas.length) || c.linhas.length;
        if (!temBoleto) {
          pendente = /total|p[aá]gina|saldo|relat[oó]rio|per[ií]odo|benefici[aá]rio\s+venc/i.test(l) ? '' : c.nome;
          continue;
        }
        if (c.nome.replace(/[^a-z]/gi, '').length < 3 && pendente) c.nome = pendente;
        pendente = '';
        const b = montarBoleto(c, out.length);
        if (b) out.push(b);
      }
    }
    // mesmo boleto repetido (ex.: cabeçalho e detalhe)
    const vistos = new Set();
    return out.filter(b => { const k = b.linha || `${b.vencimento}|${b.valor}|${b.beneficiario}`; if (vistos.has(k)) return false; vistos.add(k); return true; });
  }

  // Confere cada boleto do DDA com as contas a pagar (todas, em aberto e pagas).
  // situacao: lancado (valor + vencimento ±janela + nome) | provavel (valor +
  // vencimento, nome não bate) | divergente (mesmo fornecedor, valor ou
  // vencimento diferente) | falta (nada parecido no Conta Azul).
  function conferirDDA(boletos, parcelas, opts) {
    const janela = (opts && opts.janelaDias) != null ? opts.janelaDias : 3;
    const pagar = parcelas.filter(p => p.tipo === 'pagar');
    const nomeSim = (b, p) => Math.max(similaridadeNome(b.beneficiario, p.nome), similaridadeNome(p.nome, b.beneficiario),
      similaridadeNome(b.beneficiario, p.descricao) * 0.8);
    const valorP = p => Math.round(Number(p.total != null ? p.total : p.valor) * 100);
    const cand = [];
    for (const b of boletos) {
      for (const p of pagar) {
        const dias = diasEntre(b.vencimento, p.vencimento);
        const nome = nomeSim(b, p);
        const mesmoValor = b.valores.includes(valorP(p));
        let situacao = null;
        if (mesmoValor && dias <= janela) situacao = nome >= 0.5 ? 'lancado' : 'provavel';
        else if (nome >= 0.5 && ((mesmoValor && dias <= 31) ||
          (dias <= janela && Math.abs(valorP(p) - b.valores[0]) <= b.valores[0] * 0.15))) situacao = 'divergente';
        if (!situacao) continue;
        const peso = { lancado: 300, provavel: 200, divergente: 100 }[situacao];
        cand.push({ b, p, situacao, dias, nome, score: peso + 20 * nome - dias });
      }
    }
    cand.sort((x, y) => y.score - x.score);
    const usadosB = new Set(), usadosP = new Set(), res = {};
    for (const c of cand) {
      if (usadosB.has(c.b.id) || usadosP.has(c.p.id)) continue;
      usadosB.add(c.b.id); usadosP.add(c.p.id);
      res[c.b.id] = { situacao: c.situacao, parcela: c.p, dias: c.dias, similaridade: Math.round(c.nome * 100) / 100 };
    }
    return boletos.map(b => ({ boleto: b, ...(res[b.id] || { situacao: 'falta', parcela: null }) }));
  }

  const api = { parseValorBR, parseData, parseOFX, parseCSV, parseExtrato, similaridadeNome, conciliar, dadosComprovante, casarComprovantes,
    nomeNoExtrato, nomeBate, nomeForte, temNome, palavrasNome, ajusteDe, montarPar, reforcarComComprovantes, resumoFechamento,
    dadosLinhaDigitavel, parseDDA, conferirDDA, montarGrupo, agruparPagamentos, comprovantesDosMovimentos };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Conciliacao = api;
})(this);
