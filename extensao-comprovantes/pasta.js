// Lê a pasta de comprovantes e guarda: dados (chrome.storage "pasta") e arquivos (IndexedDB).
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';
const $ = id => document.getElementById(id);
const EXT = /\.(pdf|png|jpe?g|webp)$/i;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const status = (cls, html) => { $('status').className = cls || ''; $('status').innerHTML = html; };

async function textoPdf(file) {
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer(), verbosity: 0 }).promise;
  let t = '';
  for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) t += (await (await pdf.getPage(i)).getTextContent()).items.map(x => x.str).join(' ') + '\n';
  return t;
}
async function listar(dir, prefixo = '', out = []) {
  for await (const [nome, h] of dir.entries()) {
    if (h.kind === 'directory') await listar(h, prefixo + nome + '/', out);
    else if (EXT.test(nome)) { try { out.push({ caminho: prefixo + nome, file: await h.getFile() }); } catch { /* só na nuvem / apagado */ } }
  }
  return out;
}

async function ler(handle) {
  const dias = Number($('dias').value);
  const limite = dias ? Date.now() - dias * 864e5 : 0;
  status('', `Lendo <b>${esc(handle.name)}</b>…`);
  const todos = (await listar(handle)).filter(a => a.file.lastModified >= limite);
  const lidos = [];
  let semValor = 0;
  await jcrIdb.limpar('arquivos');
  for (const [k, a] of todos.entries()) {
    if (k % 10 === 0) status('', `Lendo <b>${esc(handle.name)}</b>… ${k}/${todos.length}`);
    let texto = '';
    if (/\.pdf$/i.test(a.caminho)) { try { texto = await textoPdf(a.file); } catch { /* PDF protegido/corrompido: fica só o nome */ } }
    const nomeArq = a.caminho.split('/').pop();
    const d = Conciliacao.dadosComprovante(texto, nomeArq);
    if (!d.valores.length) { semValor++; continue; }
    const id = `${a.caminho}|${a.file.size}|${a.file.lastModified}`;
    await jcrIdb.set('arquivos', id, a.file);
    lidos.push({ id, arquivo: nomeArq, caminho: a.caminho, valores: d.valores, datas: d.datas, vencimentos: d.vencimentos,
      texto: `${nomeArq.replace(/\.[a-z0-9]+$/i, '')} ${texto}`.slice(0, 3000), modificado: a.file.lastModified });
  }
  await chrome.storage.local.set({ pasta: { nome: handle.name, lidaEm: Date.now(), itens: lidos } });
  status('ok', `✓ <b>${lidos.length}</b> comprovante(s) lidos de <b>${esc(handle.name)}</b>${semValor ? ` · <span class="aviso">${semValor} sem valor reconhecível (padronize o nome do arquivo)</span>` : ''}. Pode voltar ao Conta Azul e apertar F5.`);
  $('tab').innerHTML = '<tr><th>Arquivo</th><th>Valores</th><th>Datas</th><th>Venc.</th></tr>' + lidos.slice(0, 300).map(i =>
    `<tr><td>${esc(i.caminho)}</td><td>${i.valores.map(v => (v / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })).join(', ')}</td><td>${i.datas.join(', ')}</td><td>${i.vencimentos.join(', ')}</td></tr>`).join('');
}

async function permitir(handle) {
  if (await handle.queryPermission({ mode: 'read' }) === 'granted') return true;
  return await handle.requestPermission({ mode: 'read' }) === 'granted';
}

$('escolher').addEventListener('click', async () => {
  try {
    const h = await showDirectoryPicker({ id: 'comprovantes', mode: 'read' });
    await jcrIdb.set('cfg', 'pasta', h);
    await ler(h);
  } catch (e) { if (e.name !== 'AbortError') status('erro', esc(e.message)); }
});
$('ler').addEventListener('click', async () => {
  const h = await jcrIdb.get('cfg', 'pasta');
  if (!h) return status('erro', 'Escolha a pasta primeiro.');
  try { if (await permitir(h)) await ler(h); else status('erro', 'Sem permissão para ler a pasta.'); }
  catch (e) { status('erro', `Não consegui ler a pasta (${esc(e.message)}). Escolha de novo.`); }
});
$('dias').addEventListener('change', () => chrome.storage.local.set({ pastaDias: $('dias').value }));

(async () => {
  const { pastaDias, pasta } = await chrome.storage.local.get(['pastaDias', 'pasta']);
  if (pastaDias) $('dias').value = pastaDias;
  const h = await jcrIdb.get('cfg', 'pasta');
  if (!h) return;
  // já tem permissão (Chrome lembra quando você marca "Permitir em todas as visitas"): lê sozinho
  if (await h.queryPermission({ mode: 'read' }) === 'granted') { try { await ler(h); return; } catch {} }
  status('', `Pasta <b>${esc(h.name)}</b>${pasta ? ` · lida em ${new Date(pasta.lidaEm).toLocaleString('pt-BR')} (${pasta.itens.length} comprovantes)` : ''}. Clique em <b>Ler de novo</b> para atualizar.`);
})();
