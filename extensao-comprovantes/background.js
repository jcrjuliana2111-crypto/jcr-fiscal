// Atualização automática: o atualizar.ps1 (tarefa agendada do Windows) troca os arquivos da pasta;
// aqui a extensão percebe que a versão no disco mudou e se recarrega sozinha.
async function verificar() {
  try {
    const r = await fetch(chrome.runtime.getURL('manifest.json') + '?t=' + Date.now(), { cache: 'no-store' });
    const disco = (await r.json()).version;
    if (disco && disco !== chrome.runtime.getManifest().version) chrome.runtime.reload();
  } catch (e) { /* arquivo sendo trocado: tenta de novo no próximo ciclo */ }
}
chrome.alarms.create('verificar', { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener(verificar);
chrome.runtime.onStartup.addListener(verificar);
verificar();

// Pasta de comprovantes: abre a página de leitura e entrega os arquivos para a tela do Conta Azul.
importScripts('idb.js');
const paraDataUrl = blob => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); });
chrome.runtime.onMessage.addListener((m, _de, responder) => {
  if (m && m.tipo === 'abrirPasta') { chrome.tabs.create({ url: chrome.runtime.getURL('pasta.html') }); return; }
  if (m && m.tipo === 'arquivo') {
    jcrIdb.get('arquivos', m.id).then(async f => responder(f ? { dataUrl: await paraDataUrl(f), tipo: f.type } : { erro: 'Arquivo não encontrado. Leia a pasta de novo.' }))
      .catch(e => responder({ erro: String(e && e.message || e) }));
    return true;
  }
});
