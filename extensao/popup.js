// JCR Preenchedor — janela da extensão: escolher o processo do portal e preencher a página aberta.
const SUPABASE = 'https://onecnoicxqjhgolqncjj.supabase.co';
const CHAVE_PUB = 'sb_publishable_paOFHdYEcMr7MZdOFx16Lw_sXt0n0-9';
const PORTAL = 'https://jcrjuliana2111-crypto.github.io/jcr-fiscal/';
const M = self.JcrMapa;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TIPOS = { abertura: 'Abertura', alteracao: 'Alteração', transformacao: 'Transformação', encerramento: 'Encerramento', baixa: 'Baixa' };

const E = { sessao: null, processos: [], busca: '', escolhido: null, ficha: null, bloco: 'auto', substituir: false, somenteCorrigidos: false, resultado: null, verFicha: false };

async function api(caminho) {
  const r = await fetch(`${SUPABASE}/rest/v1/${caminho}`, { headers: { apikey: CHAVE_PUB, Authorization: 'Bearer ' + E.sessao.access_token } });
  if (r.status === 401) { await chrome.storage.local.remove('sessao'); throw new Error('sessao'); }
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function iniciar() {
  const { sessao, escolhido } = await chrome.storage.local.get(['sessao', 'escolhido']);
  if (!sessao || !sessao.access_token || (sessao.expires_at && sessao.expires_at * 1000 < Date.now() + 30000)) return telaSemLogin(!!sessao);
  E.sessao = sessao;
  $('quem').textContent = sessao.email || 'conectado';
  try {
    E.processos = await api('soc_processos?select=id,empresa,tipo,municipio,status,cliente_id,dados,updated_at&status=neq.cancelado&order=updated_at.desc&limit=300');
  } catch (e) { return e.message === 'sessao' ? telaSemLogin(true) : erro(e.message); }
  if (escolhido && E.processos.some(p => p.id === escolhido.id)) await escolher(escolhido.id, escolhido.bloco); else tela();
}

function telaSemLogin(vencida) {
  $('tela').innerHTML = `<div class="aviso">${vencida ? 'O login venceu.' : 'A extensão ainda não está conectada.'} Abra o Portal JCR e entre com o seu usuário (uma aba basta); depois clique em "Atualizar".</div>
    <button id="b-portal">Abrir o Portal JCR</button><button class="sec" id="b-atu">Atualizar</button>`;
  $('b-portal').onclick = () => chrome.tabs.create({ url: PORTAL });
  $('b-atu').onclick = () => location.reload();
}
const erro = m => { $('tela').innerHTML = `<div class="aviso">Erro: ${esc(m)}</div>`; };

async function escolher(id, bloco) {
  const p = E.processos.find(x => x.id === id); if (!p) return;
  let cliente = null;
  if (p.cliente_id) { try { cliente = (await api(`gclik_clientes?select=razao_social,nome_fantasia,cnpj,email,telefone&id=eq.${p.cliente_id}`))[0] || null; } catch (_) { /* sem cliente */ } }
  E.escolhido = p; E.ficha = M.montarFicha(p, cliente); E.bloco = bloco || 'auto'; E.resultado = null;
  // Processo com correções de exigência: por padrão preenche só os campos corrigidos, trocando o que estiver lá
  E.somenteCorrigidos = !!E.ficha.correcoes;
  await chrome.storage.local.set({ escolhido: { id, bloco: E.bloco } });
  tela();
}

function tela() {
  const lista = E.processos.filter(p => !E.busca || M.semAcento(p.empresa + ' ' + p.tipo).includes(M.semAcento(E.busca)));
  const f = E.ficha;
  const preench = f ? Object.keys(f.empresa).length + f.socios.reduce((s, x) => s + Object.keys(x).length, 0) : 0;
  $('tela').innerHTML = `
    <label>Processo do Painel Societário</label>
    <input id="busca" placeholder="Buscar empresa…" value="${esc(E.busca)}">
    <div class="lista">${lista.map(p => `<div data-id="${p.id}" class="${E.escolhido && E.escolhido.id === p.id ? 'on' : ''}">${esc(p.empresa)}<small>${esc(TIPOS[p.tipo] || p.tipo)}${p.municipio ? ' · ' + esc(p.municipio) : ''}${p.dados && p.dados.empresa ? '' : ' · sem "Dados e documentos"'}</small></div>`).join('') || '<div class="muted">Nenhum processo.</div>'}</div>
    ${f ? `
      ${preench < 5 ? '<div class="aviso">Este processo tem poucos dados. Preencha "Dados e documentos" no portal (ou envie os documentos para leitura automática) e volte aqui.</div>' : ''}
      ${f.correcoes ? `<div class="aviso" style="border-color:rgba(59,130,246,.5);background:rgba(59,130,246,.08)"><b>🛠️ Correções da exigência (${f.correcoes.itens.length})</b>${f.correcoes.exigencia ? `<div class="muted" style="margin:4px 0">${esc(f.correcoes.exigencia)}</div>` : ''}
        <ul class="res">${f.correcoes.itens.map(c => `<li>${esc(c.rotulo)}: <s>${esc(c.errado || '—')}</s> → <b>${esc(c.certo)}</b></li>`).join('')}</ul>
        <div class="linha"><input type="checkbox" id="so-corr" ${E.somenteCorrigidos ? 'checked' : ''}><span>Preencher só os campos corrigidos (contorno azul)</span></div></div>` : ''}
      <label>O que preencher nesta página</label>
      <select id="bloco"><option value="auto">Automático (reconhece sede e sócios)</option><option value="empresa">Só dados da empresa (sede)</option>
        ${f.socios.map((s, i) => `<option value="socio:${i}">Sócio ${i + 1}: ${esc(s['socio.nome'] || '')}</option>`).join('')}</select>
      <div class="linha"><input type="checkbox" id="subst" ${E.substituir ? 'checked' : ''}><span>Substituir o que já estiver preenchido</span></div>
      <button id="b-preencher">Preencher esta página</button>
      <div id="res">${resultadoHtml()}</div>
      <button class="sec" id="b-ficha">${E.verFicha ? 'Esconder' : 'Ver'} os dados (para copiar)</button>
      ${E.verFicha ? fichaHtml(f) : ''}` : '<p class="muted" style="margin-top:10px">Escolha o processo. Os dados vêm do "Dados e documentos" do portal.</p>'}
    <p class="muted" style="margin-top:10px">A extensão não envia nada ao governo nem clica em "Avançar": confira e siga. Campo em amarelo = não reconhecido; clique nele com o botão direito → "JCR: este campo é…" para ensinar.</p>`;
  $('busca').oninput = e => { E.busca = e.target.value; tela(); $('busca').focus(); $('busca').setSelectionRange(E.busca.length, E.busca.length); };
  document.querySelectorAll('.lista div[data-id]').forEach(d => d.onclick = () => escolher(d.dataset.id));
  if (!f) return;
  $('bloco').value = E.bloco;
  $('bloco').onchange = e => { E.bloco = e.target.value; chrome.storage.local.set({ escolhido: { id: E.escolhido.id, bloco: E.bloco } }); };
  $('subst').onchange = e => { E.substituir = e.target.checked; };
  if ($('so-corr')) $('so-corr').onchange = e => { E.somenteCorrigidos = e.target.checked; };
  $('b-preencher').onclick = preencher;
  $('b-ficha').onclick = () => { E.verFicha = !E.verFicha; tela(); };
  document.querySelectorAll('[data-copiar]').forEach(a => a.onclick = () => navigator.clipboard.writeText(a.dataset.copiar).then(() => { a.textContent = 'copiado'; }));
}

function fichaHtml(f) {
  const linha = (k, v) => `<div><em>${esc((M.POR_CHAVE[k] || {}).rotulo || k)}</em><span title="${esc(v)}">${esc(v)}</span><a data-copiar="${esc(v)}">copiar</a></div>`;
  return `<div class="ficha"><label>Empresa</label>${Object.entries({ ...f.empresa, ...f.ato }).map(([k, v]) => linha(k, v)).join('')}
    ${f.socios.map((s, i) => `<label>Sócio ${i + 1}</label>${Object.entries(s).map(([k, v]) => linha(k, v)).join('')}`).join('')}</div>`;
}

function resultadoHtml() {
  const r = E.resultado; if (!r) return '';
  if (r.erro) return `<div class="aviso">${esc(r.erro)}</div>`;
  const ok = r.quadros.flatMap(q => q.preenchidos), sem = r.quadros.flatMap(q => q.sem), corr = ok.filter(x => x.corrigido);
  return `${corr.length ? `<div class="ok" style="border-color:rgba(59,130,246,.5);background:rgba(59,130,246,.08)"><b>🛠️ ${corr.length} campo(s) corrigido(s)</b> (contorno azul).<ul class="res">${corr.map(x => `<li>${esc(x.rotulo)}: ${x.antes ? `<s>${esc(x.antes)}</s> → ` : ''}<b>${esc(x.valor)}</b></li>`).join('')}</ul></div>` : ''}
    <div class="ok"><b>${ok.length} campo(s) preenchido(s)</b> (contorno verde na página).
    ${ok.length ? `<ul class="res">${ok.slice(0, 12).map(x => `<li>${esc(x.rotulo)} → ${esc(x.valor)}</li>`).join('')}${ok.length > 12 ? `<li>… e mais ${ok.length - 12}</li>` : ''}</ul>` : ''}</div>
    ${sem.length ? `<div class="aviso"><b>${sem.length} sem correspondência</b> (contorno amarelo): ${esc(sem.slice(0, 8).join(' · '))}${sem.length > 8 ? '…' : ''}</div>` : ''}`;
}

async function preencher() {
  const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!aba || !/^https?:/.test(aba.url || '')) { E.resultado = { erro: 'Abra a página do formulário (Facilita SP, VRE, REDESIM, prefeitura) nesta janela e tente de novo.' }; return tela(); }
  const { aprendidos = {} } = await chrome.storage.local.get('aprendidos');
  const [bloco, iSocio] = E.bloco.startsWith('socio:') ? ['socio', +E.bloco.split(':')[1]] : [E.bloco, null];
  const op = { bloco, socio: iSocio, substituir: E.substituir, somenteCorrigidos: E.somenteCorrigidos && !!E.ficha.correcoes, aprendidos };
  await chrome.storage.session.set({ ultima: { ficha: E.ficha, socio: iSocio } });
  try {
    await chrome.scripting.executeScript({ target: { tabId: aba.id, allFrames: true }, files: ['mapa.js', 'preencher.js'] });
    const r = await chrome.scripting.executeScript({ target: { tabId: aba.id, allFrames: true }, func: (f, o) => self.__jcrPreencher(f, o), args: [E.ficha, op] });
    E.resultado = { quadros: r.map(x => x.result).filter(Boolean) };
  } catch (e) { E.resultado = { erro: 'Não foi possível acessar esta página: ' + e.message }; }
  tela();
}

iniciar();
