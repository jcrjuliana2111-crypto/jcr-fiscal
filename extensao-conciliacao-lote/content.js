/* Conciliação em lote – Conta Azul Pro
 * Na tela de Conciliações pendentes: filtra por descrição/fornecedor, marca os pares
 * idênticos (valor + data + nome do fornecedor no extrato) e seleciona em lote para
 * conciliar com o botão "Conciliar" do próprio Conta Azul.
 * Roda no mundo MAIN da página.
 */
(() => {
  if (window.__cafLote) return;
  window.__cafLote = true;

  const ITEM = 'PendingReconciliationsListItem';
  const STOP = new Set(['da', 'de', 'do', 'das', 'dos', 'e', 'ltda', 'me', 'sa', 's', 'a', 'eireli', 'epp', 'mei', 'cia', 'com', 'em']);

  // ---------- estilos ----------
  const style = document.createElement('style');
  style.textContent = `
  .caf-bar{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;margin:10px 0 14px;padding:10px 14px;
    background:#f5f9ff;border:1px solid #cfe2fb;border-radius:6px;font:13px "Open Sans",Arial,sans-serif;color:#2b3445}
  .caf-bar .caf-t{font-weight:700;color:#1b6ac9;margin-right:2px}
  .caf-bar input[type=text]{height:32px;min-width:260px;flex:1 1 260px;max-width:420px;padding:0 10px;border:1px solid #c3cad6;
    border-radius:4px;font:13px "Open Sans",Arial,sans-serif;outline:none}
  .caf-bar input[type=text]:focus{border-color:#2687e9;box-shadow:0 0 0 2px #d6e8fd}
  .caf-bar label{display:inline-flex;align-items:center;gap:5px;cursor:pointer;white-space:nowrap}
  .caf-bar select{height:32px;border:1px solid #c3cad6;border-radius:4px;font:13px "Open Sans",Arial,sans-serif;padding:0 6px;background:#fff}
  .caf-bar button{height:32px;padding:0 12px;border-radius:4px;border:1px solid #2687e9;background:#fff;color:#1b6ac9;
    font:600 13px "Open Sans",Arial,sans-serif;cursor:pointer;white-space:nowrap}
  .caf-bar button.caf-pri{background:#2687e9;color:#fff}
  .caf-bar button:disabled{opacity:.45;cursor:default}
  .caf-bar .caf-info{color:#5b6576;font-size:12px;width:100%}
  .caf-hidden{display:none !important}
  .caf-tag{display:inline-block;margin-top:6px;padding:2px 8px;border-radius:999px;font:700 11px "Open Sans",Arial,sans-serif;
    background:#e3f6ea;color:#14713a;border:1px solid #a9dfbd}
  .caf-tag.caf-partial{background:#fff6e0;color:#8a5a00;border-color:#f3cf7a}
  `;
  (document.head || document.documentElement).appendChild(style);

  // ---------- utilidades ----------
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim();
  const cents = (v) => Math.round(Math.abs(Number(v) || 0) * 100);
  const dateKey = (d) => String(d || '').slice(0, 10);

  // palavras do extrato que não são nome de ninguém (não valem como abreviação)
  const BANCO = new Set(['pix', 'ted', 'doc', 'str', 'atm', 'deb', 'cred', 'env', 'envio', 'enviado', 'recebido', 'transf',
    'transferencia', 'pagamento', 'pagto', 'pgto', 'dda', 'boleto', 'titulo', 'conta', 'agencia', 'banco']);
  // a palavra do nome aparece no extrato? Igual, ou abreviada/cortada pelo banco
  // ("serv" = "servicos", "oliv" = "oliveira", "medic" = "medicos"), com 3+ letras.
  function wordIn(t, words) {
    if (words.has(t)) return true;
    for (const w of words) {
      if (w.length < 3 || BANCO.has(w)) continue;
      if (t.startsWith(w) || (t.length >= 3 && w.startsWith(t))) return true;
    }
    return false;
  }
  function nameMatches(negotiator, bankDesc) {
    const toks = norm(negotiator).split(' ').filter(t => t.length > 1 && !STOP.has(t));
    if (!toks.length) return false;
    const words = new Set(norm(bankDesc).split(' ').filter(Boolean));
    const hit = toks.filter(t => wordIn(t, words)).length;
    // primeiro nome obrigatório (pode vir abreviado) + pelo menos 60% dos nomes
    // (extratos cortam o fim e abreviam: "RSETTI SERV MEDICOS" = "RSETTI SERVICOS MEDICOS LTDA").
    // Maiúsculas, minúsculas e acentos não importam (norm).
    if (!wordIn(toks[0], words)) return false;
    return toks.length === 1 ? true : hit >= 2 && hit / toks.length >= 0.6;
  }

  // ---------- leitura dos itens via Vue ----------
  function itemVue(form) {
    let v = form.__vue__;
    for (let i = 0; v && i < 6; i++) { if (v.$options && v.$options.name === ITEM) return v; if (v.$el !== form) break; v = v.$parent; }
    // fallback: sobe a árvore
    v = form.__vue__;
    for (let i = 0; v && i < 6; i++) { if (v.$options && v.$options.name === ITEM) return v; v = v.$parent; }
    return null;
  }

  function readItems() {
    const out = [];
    const seen = new Set();
    document.querySelectorAll('form').forEach((form) => {
      const v = itemVue(form);
      if (!v || seen.has(v)) return;
      seen.add(v);
      const rec = v.reconciliation || {};
      const bank = rec.bankStatement || {};
      const match = v.suggestedFinancialStatement || rec.match || (rec.matches && rec.matches.length === 1 ? rec.matches[0] : null);
      const el = v.$el;
      const value = match && match.valueComposition ? match.valueComposition.netValue : null;
      const sameValue = !!match && value != null && cents(bank.value) === cents(value);
      const sameDate = !!match && dateKey(bank.date) === dateKey(match.date);
      const sameName = !!match && nameMatches(match.negotiatorName, bank.description);
      const checkbox = el.querySelector('input[type=checkbox]');
      out.push({
        v, el, rec, bank, match, checkbox,
        bankDesc: bank.description || '',
        caDesc: (match && (match.note || match.description)) || '',
        supplier: (match && match.negotiatorName) || '',
        sameValue, sameDate, sameName,
        identical: sameValue && sameDate && sameName,
        valueDate: sameValue && sameDate
      });
    });
    return out;
  }

  // ---------- estado do filtro ----------
  const state = { text: '', mode: 'all', ca: '' };

  function passes(it) {
    if (state.mode === 'identical' && !it.identical) return false;
    if (state.mode === 'valuedate' && !it.valueDate) return false;
    if (state.mode === 'withmatch' && !it.match) return false;
    if (state.ca && norm(it.caDesc) !== state.ca) return false;
    if (state.text) {
      const hay = norm([it.bankDesc, it.caDesc, it.supplier, it.match && it.match.categoryName].join(' '));
      if (!norm(state.text).split(' ').every(t => hay.includes(t))) return false;
    }
    return true;
  }

  // ---------- barra de filtro (inserida na própria tela, sem botão flutuante) ----------
  let bar = null;
  function buildBar() {
    bar = document.createElement('div');
    bar.className = 'caf-bar';
    bar.innerHTML = `
      <span class="caf-t">Filtro em lote</span>
      <input type="text" class="caf-text" placeholder="Descrição, fornecedor ou texto do extrato (ex.: folha multi ago)">
      <select class="caf-ca" title="Descrição do lançamento na Conta Azul"><option value="">Todas as descrições</option></select>
      <select class="caf-mode">
        <option value="all">Todos os pares</option>
        <option value="withmatch">Só com sugestão</option>
        <option value="valuedate">Mesmo valor e data</option>
        <option value="identical">Idênticos (valor, data e nome)</option>
      </select>
      <button type="button" class="caf-sel caf-pri">Selecionar visíveis</button>
      <button type="button" class="caf-clear">Limpar seleção</button>
      <button type="button" class="caf-reset">Limpar filtro</button>
      <button type="button" class="caf-load" title="Clica em &quot;Carregar mais&quot; do Conta Azul até aparecerem todos os lançamentos">⟳ Carregar todos</button>
      <span class="caf-info"></span>`;
    const $ = (s) => bar.querySelector(s);
    $('.caf-text').addEventListener('input', (e) => { state.text = e.target.value; apply(); });
    $('.caf-ca').addEventListener('change', (e) => { state.ca = e.target.value; apply(); });
    $('.caf-mode').addEventListener('change', (e) => { state.mode = e.target.value; apply(); });
    $('.caf-sel').addEventListener('click', selectVisible);
    $('.caf-load').addEventListener('click', () => loadAll());
    $('.caf-clear').addEventListener('click', () => setSelection(() => false));
    $('.caf-reset').addEventListener('click', () => {
      state.text = ''; state.ca = ''; state.mode = 'all';
      $('.caf-text').value = ''; $('.caf-ca').value = ''; $('.caf-mode').value = 'all';
      apply();
    });
    // impede que Enter no campo envie algum formulário da página
    $('.caf-text').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
    return bar;
  }

  function placeBar() {
    const selBtn = [...document.querySelectorAll('button')].find(b => /^\s*Selecionar lan/i.test(b.textContent));
    if (!selBtn) return false;
    // sobe até a faixa de ações (linha larga com Selecionar / Conciliar / ... / Ordenar)
    let row = selBtn;
    while (row.parentElement && row.parentElement.offsetWidth < 600) row = row.parentElement;
    row = row.parentElement || row;
    if (!bar) buildBar();
    if (bar.previousElementSibling !== row) row.insertAdjacentElement('afterend', bar);
    return true;
  }

  function setSelection(want) {
    const items = readItems();
    let n = 0;
    items.forEach((it) => {
      const cb = it.checkbox; if (!cb || cb.disabled) return;
      const should = !!want(it);
      if (cb.checked !== should) cb.click();
      if (should) n++;
    });
    setTimeout(apply, 50);
    return n;
  }

  async function selectVisible() {
    // carrega todos antes, para a seleção valer para a lista inteira
    if (loadMoreBtn()) await loadAll();
    // desmarca o que está escondido e marca só os visíveis que têm lançamento sugerido
    const n = setSelection(it => passes(it) && !!it.match);
    flash(n ? `${n} par(es) selecionado(s). Confira e clique em "Conciliar" na barra do Conta Azul.` : 'Nenhum par visível com lançamento sugerido para selecionar.');
  }

  let flashMsg = '', flashT = 0;
  function flash(msg) { flashMsg = msg; clearTimeout(flashT); flashT = setTimeout(() => { flashMsg = ''; apply(); }, 8000); apply(); }

  // ---------- "Carregar mais" do Conta Azul: clica até aparecerem todos ----------
  const loadMoreBtn = () => [...document.querySelectorAll('button, a, [role=button]')].find(b =>
    /carregar\s+mais/i.test(b.textContent || '') && !(bar && bar.contains(b)) && !b.disabled && b.offsetParent !== null);
  // Devagar de propósito: o Conta Azul bloqueia (HTTP 429, "Tente novamente mais tarde")
  // quem pede muitas páginas seguidas. Pausa entre páginas, limite por rodada e para
  // de vez se aparecer o bloqueio.
  const PAUSA_MS = 3000, MAX_PAGINAS = 25;
  const bloqueado = () => /tente novamente mais tarde|grande volume de solicita|error 429/i.test(document.body ? document.body.innerText.slice(0, 5000) : '');
  let loading = null, loadedFor = '', stopped = false;
  function loadAll() {
    if (loading) return loading;
    if (stopped || bloqueado()) { stopped = true; flash('O Conta Azul pediu para esperar (muitas solicitações). Carregamento automático desligado até recarregar a página.'); return Promise.resolve(); }
    loading = (async () => {
      try {
        for (let i = 0; i < MAX_PAGINAS; i++) {
          if (bloqueado()) { stopped = true; break; }
          const b = loadMoreBtn();
          if (!b) break;
          if (i > 0) await new Promise(r => setTimeout(r, PAUSA_MS));
          if (!loadMoreBtn()) break;
          const before = readItems().length;
          loadingMsg = `Carregando todos os lançamentos… ${before} até agora`; apply();
          b.click();
          let grew = false;
          for (let t = 0; t < 40; t++) { // até 10 s por página
            await new Promise(r => setTimeout(r, 250));
            if (readItems().length > before) { grew = true; break; }
            if (!b.isConnected || !loadMoreBtn()) break;
          }
          if (!grew && loadMoreBtn() === b) break; // não carregou nada: para
        }
      } finally {
        loading = null; loadingMsg = ''; apply();
      }
    })();
    return loading;
  }
  let loadingMsg = '';

  // ---------- aplica filtro e marcações ----------
  function apply() {
    if (!bar || !bar.isConnected) return;
    const items = readItems();
    let vis = 0, ident = 0, selectable = 0, selected = 0;
    const descCount = new Map();
    items.forEach((it) => {
      if (it.caDesc) { const k = norm(it.caDesc); const c = descCount.get(k) || { label: it.caDesc, n: 0 }; c.n++; descCount.set(k, c); }
      const ok = passes(it);
      it.el.classList.toggle('caf-hidden', !ok);
      if (ok) { vis++; if (it.match) selectable++; }
      if (it.identical) ident++;
      if (it.checkbox && it.checkbox.checked) selected++;
      markItem(it);
    });

    // lista de descrições da Conta Azul (mais repetidas primeiro)
    const sel = bar.querySelector('.caf-ca');
    const sig = [...descCount.entries()].map(([k, c]) => k + c.n).join('|');
    if (sel._sig !== sig) {
      sel._sig = sig;
      const opts = [...descCount.entries()].sort((a, b) => b[1].n - a[1].n || a[1].label.localeCompare(b[1].label));
      sel.innerHTML = '<option value="">Todas as descrições</option>' +
        opts.map(([k, c]) => `<option value="${k.replace(/"/g, '')}">${c.label.replace(/</g, '&lt;')} (${c.n})</option>`).join('');
      sel.value = state.ca;
    }

    const btn = bar.querySelector('.caf-sel');
    btn.textContent = `Selecionar visíveis (${selectable})`;
    btn.disabled = !selectable;
    const total = totalPending();
    bar.querySelector('.caf-info').textContent = flashMsg || loadingMsg ||
      `Mostrando ${vis} de ${items.length} carregados${total ? ` (total na conta: ${total})` : ''} · ${ident} idêntico(s) · ${selected} selecionado(s).` +
      (stopped ? ' O Conta Azul pediu para esperar (muitas solicitações): aguarde alguns minutos e recarregue a página (F5).'
        : loadMoreBtn() ? ' Ainda há lançamentos para carregar: clique em "⟳ Carregar todos".' : '');
  }

  let tabEl = null;
  function totalPending() {
    if (!tabEl || !tabEl.isConnected) {
      tabEl = [...document.querySelectorAll('a,button,li,[role=tab]')].find(e => /Concilia[çc][õo]es pendentes/i.test(e.textContent) && e.textContent.length < 60) || null;
    }
    const m = tabEl && tabEl.textContent.replace(/\s+/g, ' ').match(/pendentes\s*(\d+)/i);
    return m ? Number(m[1]) : 0;
  }

  function markItem(it) {
    let tag = it.el.querySelector(':scope .caf-tag');
    const kind = it.identical ? 'full' : (it.valueDate ? 'partial' : '');
    if (!kind) { if (tag) tag.remove(); return; }
    // coloca a etiqueta abaixo do botão "Conciliar" do par
    const concBtn = [...it.el.querySelectorAll('button')].find(b => /^\s*Conciliar\s*$/i.test(b.textContent));
    const host = concBtn ? concBtn.parentElement : null;
    if (!host) return;
    if (!tag || tag.parentElement !== host) { if (tag) tag.remove(); tag = document.createElement('div'); host.appendChild(tag); }
    const cls = 'caf-tag' + (kind === 'partial' ? ' caf-partial' : '');
    const txt = kind === 'full' ? 'Idêntico' : 'Valor e data';
    if (tag.className !== cls) tag.className = cls;
    if (tag.textContent !== txt) tag.textContent = txt;
    tag.title = kind === 'full'
      ? 'Mesmo valor, mesma data e o nome do fornecedor aparece no extrato (igual, abreviado ou cortado pelo banco)'
      : 'Mesmo valor e data, mas o nome do fornecedor não aparece no extrato';
  }

  // ---------- loop ----------
  let pending = false;
  function tick() {
    pending = false;
    const onRecon = /financeiro\/contas\//.test(location.hash);
    if (!onRecon) { if (bar && bar.isConnected) bar.remove(); return; }
    if (placeBar()) {
      apply();
      // ao abrir a tela de conciliação, já carrega todos (uma vez por endereço)
      if (loadedFor !== location.href && readItems().length) { loadedFor = location.href; loadAll(); }
    }
  }
  const schedule = () => { if (!pending) { pending = true; setTimeout(tick, 300); } };
  new MutationObserver((muts) => {
    // ignora mudanças feitas pela própria barra
    const ours = (n) => n && n.nodeType === 1 && (n.classList.contains('caf-tag') || n.classList.contains('caf-bar'));
    if (muts.every(m => (bar && (bar.contains(m.target) || m.target === bar)) || (m.target.classList && m.target.classList.contains('caf-tag')) ||
      ([...m.addedNodes, ...m.removedNodes].length && [...m.addedNodes, ...m.removedNodes].every(ours)))) return;
    schedule();
  }).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('hashchange', schedule);
  document.addEventListener('change', (e) => { if (e.target && e.target.type === 'checkbox' && !(bar && bar.contains(e.target))) schedule(); }, true);
  schedule();
})();
