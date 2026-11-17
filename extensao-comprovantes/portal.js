// Ponte entre o robô de conciliação (Portal JCR) e a extensão.
// O robô manda {tipo:'jcr-comprovantes', itens:[...]} por window.postMessage;
// cada item traz o arquivo como dataURL. Guardamos em chrome.storage.local.
(function () {
  window.addEventListener('message', async (ev) => {
    if (ev.source !== window || !ev.data || ev.data.tipo !== 'jcr-comprovantes') return;
    const novos = Array.isArray(ev.data.itens) ? ev.data.itens : [];
    const { pendentes = [] } = await chrome.storage.local.get('pendentes');
    const porId = new Map(pendentes.map(p => [p.id, p]));
    for (const it of novos) porId.set(it.id, { ...porId.get(it.id), ...it, status: porId.get(it.id)?.status === 'feito' ? 'feito' : 'pendente' });
    const lista = [...porId.values()].slice(-500);
    await chrome.storage.local.set({ pendentes: lista });
    window.postMessage({ tipo: 'jcr-comprovantes-ok', recebidos: novos.length, total: lista.filter(p => p.status !== 'feito').length }, '*');
  });
  // avisa o robô que a extensão está instalada
  window.postMessage({ tipo: 'jcr-extensao-pronta', versao: chrome.runtime.getManifest().version }, '*');
  window.addEventListener('message', (ev) => {
    if (ev.source === window && ev.data && ev.data.tipo === 'jcr-extensao-ping') {
      window.postMessage({ tipo: 'jcr-extensao-pronta', versao: chrome.runtime.getManifest().version }, '*');
    }
  });
})();
