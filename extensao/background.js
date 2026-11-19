// JCR Preenchedor — serviço de fundo: guarda a sessão vinda do portal e cuida do menu "este campo é…".
importScripts('mapa.js');
const M = self.JcrMapa;

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.tipo === 'sessao' && msg.sessao && msg.sessao.access_token) chrome.storage.local.set({ sessao: msg.sessao });
});

// Menu do botão direito em campos: JCR → este campo é… → Empresa / Sócio / Ato → campo
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'jcr', title: 'JCR: este campo é…', contexts: ['editable'] });
    const grupos = { empresa: 'Empresa (sede)', socio: 'Sócio', ato: 'Ato (alteração/encerramento)' };
    Object.entries(grupos).forEach(([g, nome]) => {
      chrome.contextMenus.create({ id: 'g-' + g, parentId: 'jcr', title: nome, contexts: ['editable'] });
      M.CAMPOS.filter(c => c.escopo === g).forEach(c => chrome.contextMenus.create({ id: c.chave, parentId: 'g-' + g, title: c.rotulo, contexts: ['editable'] }));
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!M.POR_CHAVE[info.menuItemId] || !tab) return;
  const chave = info.menuItemId;
  const { ultima } = await chrome.storage.session.get('ultima');
  const valor = ultima ? M.valorDe(ultima.ficha, chave, ultima.socio != null ? +ultima.socio : 0) : null;
  const alvo = { tabId: tab.id, frameIds: [info.frameId || 0] };
  try {
    await chrome.scripting.executeScript({ target: alvo, files: ['mapa.js', 'preencher.js'] });
    const [r] = await chrome.scripting.executeScript({ target: alvo, func: (c, v) => self.__jcrAprender(c, v), args: [chave, valor] });
    if (!r || !r.result) return;
    const { aprendidos = {} } = await chrome.storage.local.get('aprendidos');
    aprendidos[r.result.assinatura] = chave;
    await chrome.storage.local.set({ aprendidos });
  } catch (e) { console.warn('JCR Preenchedor:', e); }
});
