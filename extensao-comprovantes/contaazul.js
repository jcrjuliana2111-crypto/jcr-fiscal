// Painel "📎 Comprovantes" dentro do Conta Azul.
// Lista os comprovantes que o robô mandou, destaca o do lançamento aberto
// (valor que aparece na tela) e coloca o arquivo no campo de anexo aberto.
(function () {
  if (window.__jcrComprovantes) return;
  window.__jcrComprovantes = true;

  const brl = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const valorTxt = v => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dt = s => s ? String(s).slice(0, 10).split('-').reverse().join('/') : '';
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- interface (shadow DOM para não brigar com o CSS do Conta Azul) ----------
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483646';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
    :host { all: initial; }
    * { box-sizing: border-box; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; }
    .fab { background: #1f6feb; color: #fff; border: 0; border-radius: 999px; padding: 10px 16px; font-weight: 600; font-size: 14px; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,.25); }
    .painel { display: none; position: absolute; right: 0; bottom: 52px; width: 420px; max-width: calc(100vw - 36px); max-height: 70vh; overflow: auto;
      background: #fff; color: #1c2230; border: 1px solid #d0d7e2; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.2); }
    .painel.aberto { display: block; }
    .top { position: sticky; top: 0; background: #fff; padding: 12px; border-bottom: 1px solid #e6ebf2; display: grid; gap: 8px; }
    .top b { font-size: 14px; }
    input { width: 100%; padding: 7px 9px; border: 1px solid #c9d2df; border-radius: 8px; font-size: 13px; }
    .msg { font-size: 12px; color: #4a5468; }
    .msg.erro { color: #b42318; } .msg.ok { color: #127a3a; }
    .item { padding: 10px 12px; border-bottom: 1px solid #eef1f6; display: grid; gap: 4px; font-size: 13px; }
    .item.destaque { background: #fff8e1; }
    .item.feito { opacity: .55; }
    .linha { display: flex; justify-content: space-between; gap: 8px; }
    .sub { color: #5b667a; font-size: 12px; word-break: break-word; }
    .acoes { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px; }
    button.b { border: 1px solid #c9d2df; background: #f6f8fb; border-radius: 7px; padding: 5px 9px; font-size: 12px; cursor: pointer; }
    button.b.pri { background: #1f6feb; color: #fff; border-color: #1f6feb; }
    .tag { font-size: 11px; background: #ffe7a3; color: #7a5200; border-radius: 99px; padding: 1px 7px; }
    .vazio { padding: 16px 12px; font-size: 13px; color: #5b667a; }
  </style>
  <div class="painel" id="painel">
    <div class="top">
      <div class="linha"><b>📎 Comprovantes para anexar</b><button class="b" id="fechar">fechar</button></div>
      <input id="busca" placeholder="filtrar por nome, valor ou arquivo">
      <div class="msg" id="msg">Abra o lançamento no Conta Azul, abra a área de anexo e clique em <b>Anexar aqui</b>.</div>
      <div class="linha"><span class="sub" id="pastaInfo"></span><button class="b" id="abrirPasta">Escolher / ler pasta</button></div>
      <label class="sub"><input type="checkbox" id="mostrarFeitos" style="width:auto"> mostrar os já anexados</label>
    </div>
    <div id="lista"></div>
  </div>
  <button class="fab" id="fab">📎 Comprovantes</button>`;
  document.documentElement.appendChild(host);
  const $ = id => root.getElementById(id);

  let itens = [];
  let pasta = null, usados = new Set(); // comprovantes lidos da pasta (página 📂) e os já anexados
  async function carregar() {
    const { pendentes = [], pasta: p = null, usados: u = [] } = await chrome.storage.local.get(['pendentes', 'pasta', 'usados']);
    itens = pendentes; pasta = p; usados = new Set(u);
    const n = itens.filter(i => i.status !== 'feito').length;
    $('fab').textContent = `📎 Comprovantes (${n})` + (pasta ? ` · 📂 ${pasta.itens.filter(i => !usados.has(i.id)).length}` : '');
    $('pastaInfo').innerHTML = pasta
      ? `📂 <b>${esc(pasta.nome)}</b> · ${pasta.itens.length} comprovante(s) · lida em ${new Date(pasta.lidaEm).toLocaleString('pt-BR')}`
      : '📂 Nenhuma pasta lida: os 📎 aparecem só para o que o robô mandar.';
    if ($('painel').classList.contains('aberto')) render();
  }
  chrome.storage.onChanged.addListener(c => { if (c.pendentes || c.pasta || c.usados) carregar(); });

  function msg(tipo, html) { const el = $('msg'); el.className = 'msg ' + (tipo || ''); el.innerHTML = html; }

  // comprovante provável do lançamento aberto: o valor dele aparece na tela (e, de preferência, o nome)
  function pontuacao(it) {
    const tela = norm(document.body.innerText);
    let p = 0;
    if (tela.includes(norm(valorTxt(it.valor)))) p += 2;
    const palavras = norm(it.contato).split(/[^a-z0-9]+/).filter(w => w.length >= 4);
    if (palavras.length && palavras.filter(w => tela.includes(w)).length >= Math.min(2, palavras.length)) p += 1;
    return p;
  }

  function render() {
    const f = norm($('busca').value);
    const mostrarFeitos = $('mostrarFeitos').checked;
    const lista = itens
      .filter(i => mostrarFeitos || i.status !== 'feito')
      .filter(i => !f || norm(`${i.contato} ${i.descricao} ${i.arquivo} ${valorTxt(i.valor)}`).includes(f))
      .map(i => ({ i, p: pontuacao(i) }))
      .sort((a, b) => b.p - a.p || String(a.i.data).localeCompare(String(b.i.data)));
    if (!lista.length) {
      $('lista').innerHTML = `<div class="vazio">${itens.length ? 'Nada nesta lista.' : 'Nenhum comprovante recebido. No robô de conciliação, depois da baixa, clique em <b>📎 Mandar comprovantes para a extensão</b>.'}</div>`;
      return;
    }
    $('lista').innerHTML = lista.map(({ i, p }) => `
      <div class="item ${p >= 2 ? 'destaque' : ''} ${i.status === 'feito' ? 'feito' : ''}">
        <div class="linha"><b>${esc(i.contato || '—')}</b><span>${brl(i.valor)}</span></div>
        <div class="sub">${esc(i.descricao || '')} · pago em ${dt(i.data)}${i.vencimento ? ` · venc. ${dt(i.vencimento)}` : ''}</div>
        <div class="sub">📄 ${esc(i.arquivo)} ${p >= 2 ? '<span class="tag">provável deste lançamento</span>' : ''}</div>
        <div class="acoes">
          ${i.status === 'feito' ? `<button class="b" data-a="voltar" data-id="${esc(i.id)}">voltar para pendente</button>` : `
          <button class="b pri" data-a="anexar" data-id="${esc(i.id)}">Anexar aqui</button>
          <button class="b" data-a="baixar" data-id="${esc(i.id)}">Baixar arquivo</button>
          <button class="b" data-a="feito" data-id="${esc(i.id)}">Já anexei</button>`}
        </div>
      </div>`).join('');
  }

  function arquivoDe(it) {
    const [cab, b64] = String(it.dataUrl || '').split(',');
    const tipo = (cab.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
    const bin = atob(b64 || '');
    const bytes = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
    return new File([bytes], it.arquivo, { type: tipo });
  }

  // campo de arquivo da tela: prefere o que está dentro de uma janela/modal aberta
  function campoDeArquivo() {
    const todos = [...document.querySelectorAll('input[type=file]')].filter(el => !el.disabled);
    if (!todos.length) return null;
    const emModal = todos.filter(el => el.closest('[role=dialog], [aria-modal=true], .modal, [class*="modal" i], [class*="drawer" i]'));
    return (emModal.length ? emModal : todos).at(-1);
  }

  function zonaDeArrastar() {
    const cand = [...document.querySelectorAll('div, section, label')].filter(el =>
      /arraste|solte|drop|arrastar/i.test(el.textContent || '') && el.getBoundingClientRect().width > 80 && el.children.length < 15);
    return cand.at(-1) || null;
  }

  // janela "Inserir anexos" do Conta Azul: uma linha por anexo (Forma · Anexo · Tipo · Descrição)
  function janelaAnexos() {
    const tit = [...document.querySelectorAll('h1, h2, h3, h4, header, div, span')]
      .find(el => el.children.length === 0 && /^\s*inserir anexos\s*$/i.test(el.textContent || ''));
    if (!tit) return null;
    let j = tit;
    while (j && !(j.querySelector && j.querySelector('input[type=file]') && /adicionar anexo/i.test(j.textContent || ''))) j = j.parentElement;
    return j;
  }
  function linhasDaJanela(j) {
    const linhas = [];
    for (const inp of j.querySelectorAll('input[type=file]')) {
      let l = inp.parentElement;
      while (l && l !== j && !l.querySelector('input:not([type=file]):not([type=hidden]), textarea')) l = l.parentElement;
      if (l && l !== j && !linhas.some(x => x.linha === l)) linhas.push({ linha: l, campo: inp });
    }
    return linhas;
  }
  const linhaVazia = x => !(x.campo.files && x.campo.files.length) && /escolha um arquivo/i.test(x.linha.textContent || '');
  function preencher(el, valor) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, valor);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  const esperar = ms => new Promise(r => setTimeout(r, ms));
  function colocar(campo, dtf) {
    campo.files = dtf.files;
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    campo.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function anexarNaJanela(j, it, dtf) {
    let alvo = linhasDaJanela(j).find(linhaVazia);
    if (!alvo) {
      const add = [...j.querySelectorAll('button, a, [role=button]')].find(b => /adicionar anexo/i.test(b.textContent || ''));
      if (!add) return false;
      add.click();
      for (let k = 0; k < 20 && !alvo; k++) { await esperar(150); alvo = linhasDaJanela(j).find(linhaVazia); }
      if (!alvo) return false;
    }
    colocarNaLinha(alvo, it, dtf);
    return true;
  }
  function colocarNaLinha(alvo, it, dtf) {
    colocar(alvo.campo, dtf);
    const desc = [...alvo.linha.querySelectorAll('input:not([type=file]):not([type=hidden]), textarea')]
      .filter(el => !el.readOnly && !el.closest('[role=combobox], [class*="select" i]')).at(-1);
    if (desc && !desc.value) preencher(desc, `Comprovante de pagamento - ${it.contato || it.descricao || it.arquivo}`.slice(0, 200));
  }
  async function obterArquivo(it) {
    if (it.dataUrl) return arquivoDe(it);
    const r = await chrome.runtime.sendMessage({ tipo: 'arquivo', id: it.pastaId });
    if (!r || r.erro) throw new Error((r && r.erro) || 'Não consegui pegar o arquivo da pasta.');
    return arquivoDe({ dataUrl: r.dataUrl, arquivo: it.arquivo });
  }
  const dtfDe = async it => { const d = new DataTransfer(); d.items.add(await obterArquivo(it)); return d; };

  async function anexar(it) {
    const file = arquivoDe(it);
    const dtf = new DataTransfer();
    dtf.items.add(file);
    const j = janelaAnexos();
    if (j && await anexarNaJanela(j, it, dtf)) {
      colocados.add(it.id);
      msg('ok', `Arquivo <b>${esc(it.arquivo)}</b> colocado em <b>Inserir anexos</b>, com a descrição preenchida. Escolha o <b>Tipo de anexo</b> (ex.: Comprovante), confira e clique em <b>Salvar</b>; depois clique em <b>Já anexei</b>.`);
      return;
    }
    const campo = campoDeArquivo();
    if (campo) {
      colocar(campo, dtf);
      msg('ok', `Arquivo <b>${esc(it.arquivo)}</b> colocado no campo de anexo. Confira na tela do Conta Azul e <b>salve</b>; depois clique em <b>Já anexei</b>.`);
      return;
    }
    const zona = zonaDeArrastar();
    if (zona) {
      for (const t of ['dragenter', 'dragover', 'drop']) zona.dispatchEvent(new DragEvent(t, { bubbles: true, cancelable: true, dataTransfer: dtf }));
      msg('ok', `Arquivo <b>${esc(it.arquivo)}</b> solto na área de anexo. Confira e <b>salve</b> no Conta Azul.`);
      return;
    }
    msg('erro', 'Não achei o campo de anexo nesta tela. No lançamento, abra <b>Inserir anexos</b> no Conta Azul e clique em <b>Anexar aqui</b> de novo. Se não funcionar, use <b>Baixar arquivo</b> e anexe à mão.');
  }

  function baixar(it) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(arquivoDe(it));
    a.download = it.arquivo;
    document.body.appendChild(a); a.click(); a.remove();
  }

  async function marcar(id, status) {
    const { pendentes = [] } = await chrome.storage.local.get('pendentes');
    await chrome.storage.local.set({ pendentes: pendentes.map(p => p.id === id ? { ...p, status } : p) });
  }


  // ---------- ícones 📎 nos lançamentos (contas a pagar, conciliação...) para arrastar até o anexo ----------
  const camada = document.createElement('div');
  camada.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483645';
  const raiz = camada.attachShadow({ mode: 'open' });
  raiz.innerHTML = `<style>
    * { box-sizing: border-box; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; }
    .chip { position: fixed; pointer-events: auto; cursor: grab; user-select: none; white-space: nowrap;
      width: 20px; height: 20px; border-radius: 50%; background: #1f6feb; display: grid; place-items: center;
      box-shadow: 0 1px 4px rgba(0,0,0,.25); }
    .chip svg { width: 12px; height: 12px; }
    .chip .n { position: absolute; top: -6px; right: -7px; background: #e5484d; color: #fff; font-size: 9px; line-height: 13px;
      min-width: 13px; padding: 0 3px; border-radius: 99px; text-align: center; font-weight: 700; }
    .chip.grande { width: auto; height: 26px; border-radius: 99px; padding: 0 12px; display: flex; gap: 6px; align-items: center;
      font-size: 13px; color: #fff; }
    .chip:active { cursor: grabbing; }
    .aviso { position: fixed; left: 50%; top: 14px; transform: translateX(-50%); pointer-events: none; background: #1c2230; color: #fff;
      font-size: 13px; padding: 8px 14px; border-radius: 8px; box-shadow: 0 4px 14px rgba(0,0,0,.3); display: none; max-width: 90vw; }
  </style><div id="chips"></div><div class="aviso" id="aviso"></div>`;
  document.documentElement.appendChild(camada);
  const chipsEl = raiz.getElementById('chips');
  let atual = null, atuais = [];          // lançamento em que você clicou por último (o que tem 📎)
  let arrastando = null;
  const colocados = new Set(); // colocados na janela de anexos, esperando o Salvar

  function aviso(txt) {
    const a = raiz.getElementById('aviso');
    a.textContent = txt; a.style.display = 'block';
    clearTimeout(aviso.t); aviso.t = setTimeout(() => { a.style.display = 'none'; }, 4500);
  }
  const palavrasDe = it => norm(it.contato).split(/[^a-z0-9]+/).filter(w => w.length >= 4);
  const nomeNaLinha = (it, txt) => { const p = palavrasDe(it); return p.length > 0 && p.filter(w => txt.includes(w)).length >= Math.min(2, p.length); };
  const eNosso = el => el === host || el === camada;

  // linha do lançamento: sobe a partir do valor enquanto continuar com "cara de linha" (baixa)
  // linha da lista ou cartão da conciliação: sobe enquanto continuar sendo "um lançamento só"
  // (até ~320px de altura e no máximo 3 valores em R$: total, a pagar, juros/desconto)
  const qtdValores = t => (String(t).match(/\d,\d{2}(?!\d)/g) || []).length;
  function linhaDe(el) {
    let l = el;
    for (let k = 0, p = el.parentElement; k < 12 && p && p !== document.body; k++, p = p.parentElement) {
      if (p.getBoundingClientRect().height > 320 || qtdValores(p.innerText) > 3) break;
      l = p;
    }
    return l;
  }
  // está visível (não coberto por uma janela)?
  function visivel(el, r) {
    if (r.width === 0 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return false;
    const x = Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1), y = Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1);
    const topo = document.elementFromPoint(x, y);
    return !!topo && (topo === el || el.contains(topo) || topo.contains(el));
  }

  // acha os lançamentos na tela cujo valor (e, se possível, nome) bate com um comprovante pendente
  function candidatos() {
    const lista = itens.filter(i => i.status !== 'feito' && i.dataUrl)
      .map(it => ({ it, valores: [valorTxt(Math.abs(it.valor))], bate: txt => nomeNaLinha(it, txt) }));
    const doRobo = new Set(itens.map(i => norm(i.arquivo)));
    for (const p of (pasta ? pasta.itens : [])) {
      if (usados.has(p.id) || doRobo.has(norm(p.arquivo))) continue;
      const valor = Math.max(...p.valores) / 100;
      const it = { id: 'pasta:' + p.id, pastaId: p.id, origem: 'pasta', arquivo: p.arquivo, valor,
        contato: p.arquivo.replace(/\.[a-z0-9]+$/i, '').replace(/^\s*(favorecido|fornecedor)\s*:?\s*/i, '').replace(/\s*R\$.*$/i, '') || p.arquivo };
      lista.push({ it, valores: p.valores.filter(v => v > 0).map(v => valorTxt(v / 100)), bate: txt => batePasta(p, txt) });
    }
    return lista;
  }
  // palavras comuns nas linhas do Conta Azul que, sozinhas, não identificam ninguém
  const GENERICO = new Set(['mensal', 'pedido', 'venda', 'compra', 'fechamento', 'acordo', 'judicial', 'material', 'medicamento', 'medico',
    'consumo', 'locacao', 'equipamento', 'servicos', 'servico', 'comercio', 'plantao', 'extra', 'protesto', 'dias', 'apos', 'solicitacao',
    'aberto', 'vencido', 'atrasado', 'curinga', 'total', 'parcela', 'referente', 'nota', 'fiscal', 'fatura', 'mercadoria', 'produtos',
    'distribuidora', 'limpeza', 'folha', 'acoes', 'situacao', 'pagar', 'receber', 'despesa', 'despesas', 'outros', 'diversos']);
  const isoDe = t => [...t.matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)].map(m => `${m[3]}-${m[2]}-${m[1]}`);
  const diasEntre = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) / 864e5;
  // comprovante da pasta bate com a linha? 2+ palavras de nome em comum (1+ não genérica) e datas compatíveis
  function batePasta(p, txt) {
    const C = window.Conciliacao;
    const comp = new Set(C.palavrasNome(p.texto));
    const comuns = C.palavrasNome(txt).filter(w => comp.has(w));
    const fortes = comuns.filter(w => !GENERICO.has(w));
    const datasLinha = isoDe(txt);
    let dataBate = null; // null = sem data para comparar
    if (datasLinha.length) {
      if (p.vencimentos.length) dataBate = p.vencimentos.some(v => datasLinha.some(d => diasEntre(v, d) <= 3));
      else if (p.datas.length) dataBate = p.datas.some(v => datasLinha.some(d => diasEntre(v, d) <= 5));
    }
    if (dataBate === false) return false;
    // 2+ palavras em comum (1+ não genérica), ou 1 palavra marcante (5+ letras) com a data batendo
    return (comuns.length >= 2 && fortes.length >= 1) || (dataBate === true && fortes.some(w => w.length >= 5));
  }

  function acharNaTela() {
    const cands = candidatos();
    if (!cands.length) return [];
    const porValor = new Map();
    for (const c of cands) for (const v of c.valores) (porValor.get(v) || porValor.set(v, []).get(v)).push(c);
    const re = new RegExp(`(^|[^\\d.,])(${[...porValor.keys()].map(v => v.replace(/\./g, '\\.')).join('|')})(?![\\d])`);
    const achados = [];
    const jan = janelaAnexos();
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const m = re.exec(n.nodeValue);
      if (!m) continue;
      const el = n.parentElement;
      if (!el || (jan && jan.contains(el)) || el.closest('script,style,textarea')) continue;
      if (!visivel(el, el.getBoundingClientRect())) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      const r = rg.getBoundingClientRect(); // só o texto do valor (a célula pode ser bem mais larga)
      const linha = linhaDe(el), txt = norm(linha.innerText);
      // só mostra o 📎 quando o nome do favorecido também está na linha (valor sozinho engana)
      // um ícone só por lançamento (o valor aparece em Total e em A pagar): fica no primeiro
      let a = achados.find(x => x.linha === linha || x.linha.contains(linha) || linha.contains(x.linha));
      for (const c of porValor.get(m[2]).filter(c => c.bate(txt))) {
        if (!a) achados.push(a = { linha, el, r, n, its: [] });
        if (!a.its.includes(c.it)) a.its.push(c.it);
      }
    }
    for (const a of achados) a.it = a.its[0];
    return achados;
  }

  let ultimos = [];
  const acharItem = id => itens.find(i => i.id === id) || ultimos.find(i => i.id === id) || (atual && atual.id === id ? atual : null);
  const CLIPE = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.5l-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l9.2-9.2a3.7 3.7 0 0 1 5.2 5.2l-9.2 9.2a1.8 1.8 0 0 1-2.6-2.6l8.5-8.5"/></svg>';
  function chipHtml(it, cls, x, y, todos) {
    for (const i of (todos || [it])) if (!ultimos.includes(i)) ultimos.push(i);
    const lista = (todos || [it]).map(i => i.arquivo).join('\n');
    const n = todos && todos.length > 1 ? `<span class="n">${todos.length}</span>` : '';
    return `<div class="chip ${cls}" draggable="true" data-id="${esc(it.id)}" style="left:${Math.round(x)}px;top:${Math.round(y)}px"
      title="${esc(lista)}\n\nArraste até o campo de anexo do Conta Azul (ou clique com a janela Inserir anexos aberta)">${CLIPE}${n}${cls.includes('grande') ? esc(it.contato || it.arquivo) + ' · ' + brl(Math.abs(it.valor)) : ''}</div>`;
  }

  let linhas = [];
  function desenhar() {
    if (arrastando) return;
    let html = '';
    linhas = []; ultimos = [];
    try {
      for (const a of acharNaTela()) {
        linhas.push(a);
        html += chipHtml(a.it, '', a.r.right + 6, a.r.top + a.r.height / 2 - 10, a.its); // à direita do valor
      }
      // janela "Inserir anexos" aberta: mostra os comprovantes do lançamento ao lado do título
      const jan = janelaAnexos();
      if (jan) {
        const pend = itens.filter(i => i.status !== 'feito' && i.dataUrl);
        const at = atual && (atual.origem === 'pasta' ? (usados.has(atual.pastaId) ? null : atual) : pend.find(i => i.id === atual.id));
        const sug = [at, ...atuais.filter(i => i.origem === 'pasta' && !usados.has(i.pastaId)), ...pend.filter(i => pontuacao(i) >= 2)].filter((i, k, arr) => i && arr.findIndex(x => x && x.id === i.id) === k && (i.origem === 'pasta' || i.status !== 'feito')).slice(0, 3);
        const tit = [...jan.querySelectorAll('*')].find(el => el.children.length === 0 && /^\s*inserir anexos\s*$/i.test(el.textContent || ''));
        let r = (tit || jan).getBoundingClientRect();
        if (tit) { const rg = document.createRange(); rg.selectNodeContents(tit); r = rg.getBoundingClientRect(); }
        let x = r.right + 16, y = r.top + r.height / 2 - 12;
        for (const it of sug) {
          const larg = 60 + 7 * (String(it.contato || it.arquivo).length + 14);
          if (x + larg > innerWidth - 8) { x = r.left; y += 30; }
          html += chipHtml(it, 'grande', x, y); x += larg + 8;
        }
      }
    } catch (e) { /* tela mudando: tenta de novo no próximo ciclo */ }
    if (chipsEl.innerHTML !== html) chipsEl.innerHTML = html;
    ancoras = linhas.map(a => a.n);
  }

  // clicou num lançamento que tem 📎: ele vira o "atual" (aparece em destaque quando abrir Inserir anexos)
  document.addEventListener('click', e => {
    if (eNosso(e.target)) return;
    if (!janelaAnexos()) desenhar(); // a tela pode ter mudado desde o último ciclo
    const a = linhas.find(x => x.linha.contains(e.target));
    if (a) { atual = a.it; atuais = a.its; }
    // Salvar da janela de anexos: os comprovantes colocados nela saem da lista
    const b = e.target.closest && e.target.closest('button, [role=button]');
    const jan = janelaAnexos();
    if (b && jan && /^\s*salvar\s*$/i.test(b.textContent || '') && colocados.size) {
      const daPasta = [...colocados].filter(id => id.startsWith('pasta:')).map(id => id.slice(6));
      for (const id of colocados) if (!id.startsWith('pasta:')) marcar(id, 'feito');
      if (daPasta.length) chrome.storage.local.set({ usados: [...new Set([...usados, ...daPasta])] });
      colocados.clear();
    }
  }, true);

  chipsEl.addEventListener('click', async e => {
    const c = e.target.closest('.chip'); if (!c) return;
    const it = acharItem(c.dataset.id); if (!it) return;
    atual = it;
    const jan = janelaAnexos();
    if (jan && await anexarNaJanela(jan, it, await dtfDe(it))) { colocados.add(it.id); aviso(`${it.arquivo} colocado. Escolha o Tipo de anexo e clique em Salvar.`); }
    else aviso(`Arraste o 📎 até o campo "Escolha um arquivo / arraste-o", ou abra Inserir anexos e clique nele.`);
  });
  chipsEl.addEventListener('dragstart', e => {
    const c = e.target.closest('.chip'); if (!c) return;
    arrastando = acharItem(c.dataset.id);
    if (!arrastando) return;
    atual = arrastando;
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', arrastando.arquivo);
  });
  chipsEl.addEventListener('dragend', () => { setTimeout(() => { arrastando = null; desenhar(); }, 50); });

  // o campo do Conta Azul só aceita arquivos "de verdade": a extensão intercepta o soltar e coloca o arquivo nele
  function campoPerto(el) {
    const jan = janelaAnexos();
    if (jan && jan.contains(el)) {
      const ls = linhasDaJanela(jan);
      const l = ls.find(x => x.linha.contains(el));
      if (l) return { linha: l };
    }
    for (let p = el; p && p !== document.body; p = p.parentElement) {
      const f = p.querySelector && p.querySelector('input[type=file]');
      if (f) return { campo: f };
      if (p.getBoundingClientRect().height > 260) break;
    }
    return null;
  }
  addEventListener('dragover', e => {
    if (!arrastando) return;
    e.preventDefault(); e.stopImmediatePropagation();
    e.dataTransfer.dropEffect = campoPerto(e.target) ? 'copy' : 'none';
  }, true);
  addEventListener('dragenter', e => { if (arrastando) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  addEventListener('drop', async e => {
    if (!arrastando) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const it = arrastando; arrastando = null;
    const alvo = campoPerto(e.target);
    if (!alvo) { aviso('Solte em cima do campo "Escolha um arquivo / arraste-o para este espaço".'); return; }
    let dtf;
    try { dtf = await dtfDe(it); } catch (er) { aviso(er.message); return; }
    if (alvo.linha) colocarNaLinha(alvo.linha, it, dtf); else colocar(alvo.campo, dtf);
    colocados.add(it.id);
    aviso(`${it.arquivo} colocado. Escolha o Tipo de anexo, confira e clique em Salvar.`);
    desenhar();
  }, true);

  setInterval(desenhar, 1200);
  // a cada quadro, cola cada ícone no texto do valor: anda junto com a rolagem, sem "dançar"
  let ancoras = [];
  const rg = document.createRange();
  (function seguir() {
    const cs = chipsEl.children;
    for (let k = 0; k < ancoras.length && k < cs.length; k++) {
      const n = ancoras[k], c = cs[k];
      if (!n.isConnected) { c.style.display = 'none'; continue; }
      rg.selectNodeContents(n);
      const r = rg.getBoundingClientRect();
      const fora = r.width === 0 || r.bottom < 0 || r.top > innerHeight;
      c.style.display = fora ? 'none' : '';
      if (!fora) { c.style.left = Math.round(r.right + 6) + 'px'; c.style.top = Math.round(r.top + r.height / 2 - 10) + 'px'; }
    }
    requestAnimationFrame(seguir);
  })();

  $('abrirPasta').addEventListener('click', () => chrome.runtime.sendMessage({ tipo: 'abrirPasta' }));
  $('fab').addEventListener('click', () => { $('painel').classList.toggle('aberto'); render(); });
  $('fechar').addEventListener('click', () => $('painel').classList.remove('aberto'));
  $('busca').addEventListener('input', render);
  $('mostrarFeitos').addEventListener('change', render);
  $('lista').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-a]');
    if (!b) return;
    const it = itens.find(x => x.id === b.dataset.id);
    if (!it) return;
    if (b.dataset.a === 'anexar') await anexar(it);
    else if (b.dataset.a === 'baixar') baixar(it);
    else if (b.dataset.a === 'feito') await marcar(it.id, 'feito');
    else if (b.dataset.a === 'voltar') await marcar(it.id, 'pendente');
  });
  // a tela do Conta Azul muda sem recarregar: reavalia o "provável" de tempos em tempos com o painel aberto
  setInterval(() => { if ($('painel').classList.contains('aberto') && !root.activeElement) render(); }, 2500);
  carregar();
})();
