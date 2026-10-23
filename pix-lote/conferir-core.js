/*
 * Conferência de lista Pix × relatório do banco (Unicred).
 * Lê o texto do PDF (já extraído pelo pdf.js) do "Relatório de Transações Pendentes"
 * ou do "Extrato" e compara com a lista gerada (nome + valor).
 * Funciona no navegador (window.ConferirPix) e no Node (require) para os testes.
 */
(function (raiz) {
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const centavos = (txt) => {
    const s = String(txt || '').replace(/\./g, '').replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? Math.round(n * 100) : null;
  };
  const IGNORAR = new Set(['DOS', 'DAS', 'DE', 'DA', 'DO', 'E', 'LTDA', 'EPP', 'EIRELI', 'ME', 'SA', 'S', 'A']);
  const tokens = (s) => norm(s).split(' ').filter((p) => p.length > 2 && !IGNORAR.has(p) && !/^\d+$/.test(p));

  // junta os itens do pdf.js num texto só, com espaços simples
  function textoDeItens(paginas) {
    let t = paginas.map((itens) => itens.map((i) => i.str).join(' ')).join(' ');
    t = t.replace(/\s+/g, ' ');
    // centavos quebrados em duas linhas: "R$ 2.420,0 0" -> "R$ 2.420,00"
    t = t.replace(/(R\$ ?[\d.]+,\d) (\d)(?!\d)/g, '$1$2');
    return t;
  }

  function lerPendentes(t) {
    const regs = [];
    const re = /R\$ ?([\d.]+,\d{2}) (\d{1,2}\/\d{1,2})(?![\d\/])/g;
    let m;
    let ini = 0;
    const brutos = [];
    while ((m = re.exec(t))) {
      brutos.push({ trecho: t.slice(ini, m.index), valor: m[1], aut: m[2] });
      ini = re.lastIndex;
    }
    // descobre o "Usuário" (palavra em maiúsculas que se repete antes da descrição)
    const cont = new Map();
    for (const b of brutos) {
      const s = b.trecho.replace(/^.*?\d{2}:\s?\d{2}\s+/, '');
      const w = (s.match(/\b([A-ZÁÉÍÓÚÂÊÔÃÕÇ]{3,})\b/) || [])[1];
      if (w) cont.set(w, (cont.get(w) || 0) + 1);
    }
    const usuario = [...cont.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    for (const b of brutos) {
      let d = b.trecho.replace(/^.*?Criação Transação Usuário Descrição Data Tran\. Valor Aut\.\s*/, '');
      d = d.replace(/^.*?\d{2}\/\d{2}\s?\/\d{4} - \d{2}:\s?\d{2}\s+/, '');
      const tipo = (d.match(/^(.*?)\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{3,}\s/) || [])[1] || '';
      if (usuario && d.includes(usuario)) d = d.slice(d.indexOf(usuario) + usuario.length);
      d = d.replace(/\s*\d{2}\/\d{2}\/\d{4}\s*$/, '').trim();
      const md = d.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
      regs.push({ nome: md ? md[1] : d, descricao: md ? md[2] : '', centavos: centavos(b.valor), aut: b.aut, tipo: tipo.replace(/\s+/g, ' ').replace('Transf erência', 'Transferência').trim() });
    }
    return regs;
  }

  function lerExtrato(t) {
    const regs = [];
    const re = /(DEBITO|CREDITO|LIQUIDACAO|TRANSFERENCIA|PAGAMENTO)([A-Z \-]*?)\(\s*Doc\.:\s*([^/)]*?)\/\s*([^)]*?)\s*\)\s*((?:-\s*)?R\$ ?[\d.]+,\d{2})?\s*((?:-\s*)?R\$ ?[\d.]+,\d{2})?/g;
    let m;
    while ((m = re.exec(t))) {
      const vals = [m[5], m[6]].filter(Boolean);
      const deb = vals.find((v) => /^-/.test(v));
      const cred = !deb && /CREDITO|TRANSFERENCIA TEF/.test(m[1] + m[2]);
      const v = deb || (cred ? vals[0] : vals[0]);
      if (!v) continue;
      regs.push({ nome: m[4].trim(), descricao: (m[1] + m[2]).trim(), centavos: centavos(v.replace(/[-R$\s]/g, '')), tipo: deb ? 'débito' : 'crédito' });
    }
    return regs;
  }

  function lerRelatorio(paginas) {
    const t = textoDeItens(paginas);
    if (/Transa[cç][õo]es Pendentes/i.test(t)) {
      const total = (t.match(/Valor total:\s*R\$ ?([\d.]+,\d{2})/) || [])[1];
      const qtd = (t.match(/Transa[cç][õo]es encontradas:\s*(\d+)/) || [])[1];
      return { tipo: 'pendentes', registros: lerPendentes(t), totalInformado: total ? centavos(total) : null, qtdInformada: qtd ? +qtd : null };
    }
    if (/Extrato/i.test(t) && /Lan[cç]amentos/i.test(t)) {
      return { tipo: 'extrato', registros: lerExtrato(t).filter((r) => r.tipo === 'débito'), totalInformado: null, qtdInformada: null };
    }
    return { tipo: 'desconhecido', registros: [], totalInformado: null, qtdInformada: null };
  }

  function nomesBatem(a, b) {
    const ta = tokens(a);
    const tb = ` ${norm(b)} `;
    if (!ta.length) return false;
    const bate = ta.filter((p) => tb.includes(` ${p} `)).length;
    return bate >= Math.min(2, ta.length);
  }

  // lista: [{ nome, chave, centavos }] — registros: [{ nome, centavos, ... }]
  function conferir(lista, registros) {
    const usados = new Set();
    const resultado = lista.map((it) => {
      let achou = -1;
      registros.forEach((r, i) => {
        if (achou >= 0 || usados.has(i) || r.centavos !== it.centavos) return;
        if (nomesBatem(it.nome, r.nome)) achou = i;
      });
      if (achou < 0) {
        // mesmo nome com valor diferente?
        const parecido = registros.findIndex((r, i) => !usados.has(i) && nomesBatem(it.nome, r.nome));
        return { item: it, status: parecido >= 0 ? 'valor' : 'falta', registro: parecido >= 0 ? registros[parecido] : null };
      }
      usados.add(achou);
      return { item: it, status: 'ok', registro: registros[achou] };
    });
    const sobras = registros.filter((r, i) => !usados.has(i));
    return { resultado, sobras };
  }

  const api = { lerRelatorio, conferir, nomesBatem, textoDeItens };
  raiz.ConferirPix = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
