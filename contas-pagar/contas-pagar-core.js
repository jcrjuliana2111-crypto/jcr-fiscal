// Regras do "Contas a pagar do dia" (sem tela): datas, alertas, totais, resumo e importação da planilha.
// Usado pela página (window.ContasPagar) e pelos testes (require).
(function (root) {
  const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const r2 = n => Math.round((Number(n) || 0) * 100) / 100;

  // "1.234,56" / "1234.56" / "R$ 99,90" / número → número
  function valor(v) {
    if (typeof v === 'number') return r2(v);
    let s = String(v ?? '').replace(/[R$\s]/g, '');
    if (!s) return 0;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? r2(n) : 0;
  }
  // Date, "dd/mm/aaaa", "aaaa-mm-dd" ou número de série do Excel → "aaaa-mm-dd" ('' se não for data)
  function data(v) {
    if (v instanceof Date && !isNaN(v)) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
    if (typeof v === 'number' && v > 20000 && v < 80000) return data(new Date(Math.round((v - 25569) * 864e5) + new Date().getTimezoneOffset() * 6e4));
    const s = String(v ?? '').trim();
    let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(s);
    if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return '';
  }
  const dias = (a, b) => Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / 864e5);

  // situação pelo vencimento em relação ao dia das contas
  function situacao(item, hoje) {
    if (!item.vencimento) return { tipo: 'sem-data', dias: 0 };
    const d = dias(item.vencimento, hoje);
    return d > 0 ? { tipo: 'vencido', dias: d } : d === 0 ? { tipo: 'hoje', dias: 0 } : { tipo: 'a-vencer', dias: -d };
  }

  // avisos de cada conta: protesto, atraso, duplicado (mesmo credor e valor), não lançado no Conta Azul
  function alertas(item, todos, hoje) {
    const out = [];
    const txt = norm(`${item.descricao} ${item.obs}`);
    const sit = situacao(item, hoje);
    if (/protest/.test(txt)) out.push({ nivel: 'alto', txt: 'protesto' });
    if (sit.tipo === 'vencido') out.push({ nivel: sit.dias > 30 ? 'alto' : 'medio', txt: `vencido há ${sit.dias} dia(s)` });
    if (/juros/.test(txt)) out.push({ nivel: 'medio', txt: 'juros' });
    const iguais = todos.filter(o => o !== item && norm(o.credor) === norm(item.credor) && r2(o.valor) === r2(item.valor) && item.valor > 0);
    if (iguais.length) out.push({ nivel: 'medio', txt: `${iguais.length + 1} contas iguais (mesmo credor e valor)` });
    if (item.origem === 'manual') out.push({ nivel: 'info', txt: 'não está no Conta Azul' });
    return out;
  }

  // ordem de prioridade: vencidos (mais antigos primeiro), hoje, a vencer
  function ordenar(itens, hoje) {
    const peso = { vencido: 0, hoje: 1, 'sem-data': 2, 'a-vencer': 3 };
    return itens.slice().sort((a, b) => {
      const sa = situacao(a, hoje), sb = situacao(b, hoje);
      return peso[sa.tipo] - peso[sb.tipo] || String(a.vencimento).localeCompare(String(b.vencimento)) || norm(a.credor).localeCompare(norm(b.credor));
    });
  }

  // limite disponível da conta: o informado, ou limite + utilizado (utilizado vem negativo)
  const limiteDisponivel = s => s.disponivel !== '' && s.disponivel != null && !isNaN(valor(s.disponivel)) && String(s.disponivel).trim() !== ''
    ? Math.max(0, valor(s.disponivel)) : Math.max(0, valor(s.limite) + valor(s.utilizado));
  // saldos: limite disponível = limite + utilizado (utilizado vem negativo, como na planilha)
  function totais(itens, saldos) {
    const pagar = r2(itens.filter(i => i.pagar).reduce((t, i) => t + valor(i.valorPagar), 0));
    const semLimite = r2(saldos.reduce((t, s) => t + valor(s.saldo), 0));
    const limiteDisp = r2(saldos.reduce((t, s) => t + limiteDisponivel(s), 0));
    const comLimite = r2(semLimite + limiteDisp);
    return { pagar, qtd: itens.filter(i => i.pagar).length, semLimite, limiteDisp, comLimite,
      sobraSemLimite: r2(semLimite - pagar), sobraComLimite: r2(comLimite - pagar) };
  }

  const brl = n => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const dt = s => s ? s.split('-').reverse().join('/') : '';

  // texto para mandar ao cliente (WhatsApp/e-mail)
  function resumo(itens, saldos, hoje, cliente) {
    const sel = ordenar(itens.filter(i => i.pagar), hoje);
    const t = totais(itens, saldos);
    const linhas = [`*Contas a pagar ${dt(hoje)}*${cliente ? ' — ' + cliente : ''}`, ''];
    for (const i of sel) linhas.push(`• ${i.credor} — ${i.descricao || ''} — venc. ${dt(i.vencimento)} — *${brl(i.valorPagar)}*${i.obs ? ` (${i.obs})` : ''}`);
    linhas.push('', `Total: *${brl(t.pagar)}* (${t.qtd} conta(s))`, `Saldo disponível: ${brl(t.semLimite)}`);
    if (t.limiteDisp) linhas.push(`Limite disponível: ${brl(t.limiteDisp)}`);
    linhas.push(t.sobraSemLimite >= 0 ? `Sobra: ${brl(t.sobraSemLimite)}` :
      `Falta: ${brl(-t.sobraSemLimite)}${t.limiteDisp ? (t.sobraComLimite >= 0 ? ' (cobre com o limite)' : ` — falta ${brl(-t.sobraComLimite)} mesmo usando o limite`) : ''}`);
    return linhas.join('\n');
  }

  // lista para colar no Gerador de lista Pix (mesmos títulos da planilha)
  function listaPix(itens, hoje) {
    const sel = ordenar(itens.filter(i => i.pagar && i.pix), hoje);
    const v = n => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return ['Nome do Credor\tVencimento\tObservação\tDescrição\tValor\tPIX',
      ...sel.map(i => [i.credor, dt(i.vencimento), i.obs || '', i.descricao || '', v(i.valorPagar), i.pix].join('\t'))].join('\n');
  }

  // planilha do escritório (linhas como arrays): contas (Nome do Credor, Vencimento, Observação, Descrição, Valor, PIX)
  // e quadro de saldos (Banco, Conta, Limite, Limite utilizado, …, Saldo disponível sem limite)
  function lerPlanilha(linhas) {
    const cab = (linhas[0] || []).map(norm);
    const col = (...nomes) => cab.findIndex(c => nomes.some(n => c.startsWith(n)));
    const c = { credor: col('nome do credor', 'credor', 'fornecedor'), venc: col('vencimento'), obs: col('observacao'),
      desc: col('descricao'), valor: col('valor'), pix: col('pix', 'chave') };
    const b = { banco: col('banco'), conta: col('conta'), limite: cab.findIndex(x => x.startsWith('limite') && !x.includes('utiliz') && !x.includes('dispon')),
      utilizado: cab.findIndex(x => x.includes('utilizado')), disponivel: cab.findIndex(x => x.startsWith('limite') && x.includes('disponivel')), saldo: cab.findIndex(x => x.startsWith('saldo disponivel (sem')) };
    const itens = [], saldos = [];
    for (const l of linhas.slice(1)) {
      const credor = c.credor >= 0 ? String(l[c.credor] ?? '').trim() : '';
      if (credor) {
        const obsCel = c.obs >= 0 ? l[c.obs] : '';
        const dObs = data(obsCel);
        itens.push({ credor, vencimento: data(l[c.venc]), descricao: String(l[c.desc] ?? '').trim(),
          valor: valor(l[c.valor]), pix: c.pix >= 0 && l[c.pix] != null ? String(l[c.pix]).trim() : '',
          obs: dObs ? `pagar em ${dt(dObs)}` : String(obsCel ?? '').trim(), nota: String(l[c.pix + 1] ?? '').trim() });
      }
      const banco = b.banco >= 0 ? String(l[b.banco] ?? '').trim() : '';
      if (banco && !/^=|total/i.test(banco)) saldos.push({ banco, conta: String(l[b.conta] ?? '').trim(),
        limite: valor(l[b.limite]), utilizado: valor(l[b.utilizado]),
        disponivel: b.disponivel >= 0 && l[b.disponivel] != null && !/^=/.test(String(l[b.disponivel])) ? valor(l[b.disponivel]) : '', saldo: valor(l[b.saldo]) });
    }
    return { itens, saldos };
  }

  // a mesma conta vinda de duas fontes (planilha × Conta Azul): mesmo valor, vencimento até 5 dias e credor parecido
  const palavras = t => norm(t).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length >= 3 && !['ltda', 'eireli', 'comercio', 'servicos', 'com', 'dos', 'das'].includes(w));
  function mesmoCredor(a, b) {
    const na = norm(a).replace(/[^a-z0-9]/g, ''), nb = norm(b).replace(/[^a-z0-9]/g, '');
    if (na && nb && (na.includes(nb) || nb.includes(na))) return true;
    const pa = palavras(a), pb = new Set(palavras(b));
    const comuns = pa.filter(w => pb.has(w)).length;
    return comuns >= 2 || (comuns === 1 && Math.min(pa.length, pb.size) === 1);
  }
  function mesmaConta(a, b) {
    return r2(a.valor) === r2(b.valor) && a.valor > 0 && (!a.vencimento || !b.vencimento || Math.abs(dias(a.vencimento, b.vencimento)) <= 5) && mesmoCredor(a.credor, b.credor);
  }
  // junta as contas manuais/da planilha nas do Conta Azul (1 para 1): leva observação, PIX, nota e a marcação
  function juntar(doCA, manuais) {
    const usados = new Set(), sobra = [];
    for (const m of manuais) {
      const alvo = doCA.find(c => !usados.has(c.id) && mesmaConta(c, m));
      if (!alvo) { sobra.push(m); continue; }
      usados.add(alvo.id);
      alvo.obs = alvo.obs || m.obs; alvo.pix = alvo.pix || m.pix; alvo.nota = alvo.nota || m.nota;
      alvo.pagar = m.pagar; alvo.valorPagar = m.valorPagar;
    }
    return { itens: [...doCA, ...sobra], juntadas: manuais.length - sobra.length };
  }

  // próximo dia útil (pula sábado e domingo)
  function proximoDiaUtil(iso) {
    const d = new Date(iso + 'T12:00:00');
    do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6);
    return data(d);
  }
  // fechamento do dia: o que baixar no Conta Azul, o que reagendar e o que passa para a lista de amanhã
  function planoFechamento(itens, hoje) {
    const ca = itens.filter(i => i.origem === 'ca' && !(i.baixa && i.baixa.status === 'ok'));
    const baixar = ca.filter(i => i.pagar && valor(i.valorPagar) > 0);
    const programadaAteHoje = i => (i.previsao || i.vencimento || hoje) <= hoje;
    const reagendar = ca.filter(i => !baixar.includes(i) && programadaAteHoje(i));
    const manuais = itens.filter(i => i.origem !== 'ca');
    return { baixar, reagendar, manuaisPagos: manuais.filter(i => i.pagar && valor(i.valorPagar) > 0),
      manuaisAmanha: manuais.filter(i => !(i.pagar && valor(i.valorPagar) > 0)), amanha: proximoDiaUtil(hoje) };
  }

  const api = { proximoDiaUtil, planoFechamento, mesmoCredor, mesmaConta, juntar, limiteDisponivel, norm, valor, data, dias, situacao, alertas, ordenar, totais, resumo, listaPix, lerPlanilha, brl, dt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ContasPagar = api;
})(this);
