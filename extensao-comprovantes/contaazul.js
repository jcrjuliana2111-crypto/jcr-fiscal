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

  async function anexar(it) {
    const file = arquivoDe(it);
    const dtf = new DataTransfer();
    dtf.items.add(file);
    const campo = campoDeArquivo();
    if (campo) {
      campo.files = dtf.files;
      campo.dispatchEvent(new Event('input', { bubbles: true }));
      campo.dispatchEvent(new Event('change', { bubbles: true }));
      msg('ok', `Arquivo <b>${esc(it.arquivo)}</b> colocado no campo de anexo. Confira na tela do Conta Azul e <b>salve</b>; depois clique em <b>Já anexei</b>.`);
      return;
    }
    const zona = zonaDeArrastar();
    if (zona) {
      for (const t of ['dragenter', 'dragover', 'drop']) zona.dispatchEvent(new DragEvent(t, { bubbles: true, cancelable: true, dataTransfer: dtf }));
      msg('ok', `Arquivo <b>${esc(it.arquivo)}</b> solto na área de anexo. Confira e <b>salve</b> no Conta Azul.`);
      return;
    }
    msg('erro', 'Não achei o campo de anexo nesta tela. Abra o lançamento, clique em <b>Anexar</b>/<b>Adicionar arquivo</b> no Conta Azul e clique em <b>Anexar aqui</b> de novo. Se não funcionar, use <b>Baixar arquivo</b> e anexe à mão.');
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
