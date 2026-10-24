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
      <label class="sub"><input type="checkbox" id="mostrarFeitos" style="width:auto"> mostrar os já anexados</label>
    </div>
    <div id="lista"></div>
  </div>
  <button class="fab" id="fab">📎 Comprovantes</button>`;
  document.documentElement.appendChild(host);
  const $ = id => root.getElementById(id);

  let itens = [];
  async function carregar() {
    const { pendentes = [] } = await chrome.storage.local.get('pendentes');
    itens = pendentes;
    const n = itens.filter(i => i.status !== 'feito').length;
    $('fab').textContent = `📎 Comprovantes (${n})`;
    if ($('painel').classList.contains('aberto')) render();
  }
  chrome.storage.onChanged.addListener(c => { if (c.pendentes) carregar(); });

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
  const dtfDe = it => { const d = new DataTransfer(); d.items.add(arquivoDe(it)); return d; };

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
      font-size: 12px; line-height: 18px; padding: 0 7px; border-radius: 99px; background: #fff; color: #1f6feb;
      border: 1.5px solid #1f6feb; box-shadow: 0 2px 6px rgba(0,0,0,.18); }
    .chip.grande { font-size: 13px; line-height: 24px; padding: 0 10px; background: #1f6feb; color: #fff; }
    .chip:active { cursor: grabbing; }
    .aviso { position: fixed; left: 50%; top: 14px; transform: translateX(-50%); pointer-events: none; background: #1c2230; color: #fff;
      font-size: 13px; padding: 8px 14px; border-radius: 8px; box-shadow: 0 4px 14px rgba(0,0,0,.3); display: none; max-width: 90vw; }
  </style><div id="chips"></div><div class="aviso" id="aviso"></div>`;
  document.documentElement.appendChild(camada);
  const chipsEl = raiz.getElementById('chips');
  let atual = null;          // lançamento em que você clicou por último (o que tem 📎)
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
  function linhaDe(el) {
    let l = el;
    for (let k = 0, p = el.parentElement; k < 8 && p && p !== document.body; k++, p = p.parentElement) {
      if (p.getBoundingClientRect().height > 130) break;
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
  function acharNaTela() {
    const pend = itens.filter(i => i.status !== 'feito' && i.dataUrl);
    if (!pend.length) return [];
    const porValor = new Map();
    for (const it of pend) { const v = valorTxt(Math.abs(it.valor)); (porValor.get(v) || porValor.set(v, []).get(v)).push(it); }
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
      const cands = porValor.get(m[2]);
      // só mostra o 📎 quando o nome do favorecido também está na linha (valor sozinho engana)
      cands.filter(it => nomeNaLinha(it, txt)).forEach((it, k) => achados.push({ it, el, linha, r, k }));
    }
    return achados;
  }

  function chipHtml(it, cls, x, y) {
    return `<div class="chip ${cls}" draggable="true" data-id="${esc(it.id)}" style="left:${Math.round(x)}px;top:${Math.round(y)}px"
      title="${esc(it.arquivo)} — arraste até o campo de anexo do Conta Azul (ou clique com a janela de anexos aberta)">📎${cls.includes('grande') ? ' ' + esc(it.contato || it.arquivo) + ' · ' + brl(Math.abs(it.valor)) : ''}</div>`;
  }

  let linhas = [];
  function desenhar() {
    if (arrastando) return;
    let html = '';
    linhas = [];
    try {
      for (const a of acharNaTela()) {
        linhas.push(a);
        html += chipHtml(a.it, '', Math.max(2, a.r.left - 34 - a.k * 32), a.r.top + a.r.height / 2 - 10); // à esquerda do valor, para não cobrir botões
      }
      // janela "Inserir anexos" aberta: mostra os comprovantes do lançamento ao lado do título
      const jan = janelaAnexos();
      if (jan) {
        const pend = itens.filter(i => i.status !== 'feito' && i.dataUrl);
        const at = atual && pend.find(i => i.id === atual.id);
        const sug = [at, ...pend.filter(i => pontuacao(i) >= 2)].filter((i, k, arr) => i && i.status !== 'feito' && arr.findIndex(x => x && x.id === i.id) === k).slice(0, 3);
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
  }

  // clicou num lançamento que tem 📎: ele vira o "atual" (aparece em destaque quando abrir Inserir anexos)
  document.addEventListener('click', e => {
    if (eNosso(e.target)) return;
    if (!janelaAnexos()) desenhar(); // a tela pode ter mudado desde o último ciclo
    const a = linhas.find(x => x.linha.contains(e.target));
    if (a) atual = a.it;
    // Salvar da janela de anexos: os comprovantes colocados nela saem da lista
    const b = e.target.closest && e.target.closest('button, [role=button]');
    const jan = janelaAnexos();
    if (b && jan && /^\s*salvar\s*$/i.test(b.textContent || '') && colocados.size) {
      for (const id of colocados) marcar(id, 'feito');
      colocados.clear();
    }
  }, true);

  chipsEl.addEventListener('click', async e => {
    const c = e.target.closest('.chip'); if (!c) return;
    const it = itens.find(i => i.id === c.dataset.id); if (!it) return;
    atual = it;
    const jan = janelaAnexos();
    if (jan && await anexarNaJanela(jan, it, dtfDe(it))) { colocados.add(it.id); aviso(`${it.arquivo} colocado. Escolha o Tipo de anexo e clique em Salvar.`); }
    else aviso(`Arraste o 📎 até o campo "Escolha um arquivo / arraste-o", ou abra Inserir anexos e clique nele.`);
  });
  chipsEl.addEventListener('dragstart', e => {
    const c = e.target.closest('.chip'); if (!c) return;
    arrastando = itens.find(i => i.id === c.dataset.id) || null;
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
    if (alvo.linha) colocarNaLinha(alvo.linha, it, dtfDe(it)); else colocar(alvo.campo, dtfDe(it));
    colocados.add(it.id);
    aviso(`${it.arquivo} colocado. Escolha o Tipo de anexo, confira e clique em Salvar.`);
    desenhar();
  }, true);

  setInterval(desenhar, 1200);
  addEventListener('scroll', () => requestAnimationFrame(desenhar), true);
  addEventListener('resize', desenhar);

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
