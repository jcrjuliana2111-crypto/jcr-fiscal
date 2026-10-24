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
