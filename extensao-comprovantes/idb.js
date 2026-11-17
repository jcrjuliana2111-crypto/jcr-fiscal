// Banco local da extensão (IndexedDB): guarda a pasta escolhida e os arquivos lidos dela.
const jcrIdb = (() => {
  const abrir = () => new Promise((ok, erro) => {
    const r = indexedDB.open('jcr-comprovantes', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('cfg'); r.result.createObjectStore('arquivos'); };
    r.onsuccess = () => ok(r.result); r.onerror = () => erro(r.error);
  });
  const op = (loja, modo, fn) => abrir().then(db => new Promise((ok, erro) => {
    const t = db.transaction(loja, modo); const req = fn(t.objectStore(loja));
    t.oncomplete = () => ok(req && req.result); t.onerror = () => erro(t.error);
  }));
  return {
    get: (loja, k) => op(loja, 'readonly', s => s.get(k)),
    set: (loja, k, v) => op(loja, 'readwrite', s => s.put(v, k)),
    limpar: loja => op(loja, 'readwrite', s => s.clear())
  };
})();
