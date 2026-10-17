/*
 * JCR — proteção de acesso das páginas internas.
 *
 * Incluir no <head> de cada página interna:
 *   <script src="../assets/jcr-guard.js"></script>   (páginas em subpastas)
 *   <script src="assets/jcr-guard.js"></script>      (páginas na raiz)
 *
 * Usa a mesma sessão do Supabase Auth do portal e do Gestão Fiscal
 * (projeto onecnoicxqjhgolqncjj). Sem sessão, manda para o login do portal
 * e volta para a página depois de entrar.
 *
 * Atenção: isto bloqueia o acesso pela navegação, mas os arquivos continuam
 * públicos enquanto o repositório for público. Os dados ficam protegidos de
 * verdade apenas pelas regras do Supabase (RLS / Edge Functions com login).
 */
(function () {
  var STORAGE_KEY = 'sb-onecnoicxqjhgolqncjj-auth-token';
  var script = document.currentScript;
  var ROOT = new URL('../', script.src).href; // raiz do site (este arquivo fica em assets/)

  function sessao() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (s && s.currentSession) s = s.currentSession;
      return s && s.access_token ? s : null;
    } catch (e) { return null; }
  }

  var s = sessao();
  var expirada = s && s.expires_at && s.expires_at * 1000 < Date.now();
  if (!s || expirada) {
    // O portal renova a sessão (se ainda for válida) ou pede login, e volta para cá.
    var next = encodeURIComponent(location.href);
    location.replace(ROOT + 'index.html?next=' + next);
    document.documentElement.style.display = 'none';
    return;
  }

  // Botão flutuante "Portal" com o mesmo visual em todas as ferramentas.
  function botaoPortal() {
    if (document.getElementById('jcr-portal-pill')) return;
    var st = document.createElement('style');
    st.textContent =
      '#jcr-portal-pill{position:fixed;left:16px;bottom:16px;z-index:2147483000;display:flex;align-items:center;gap:8px;' +
      'padding:8px 14px 8px 10px;border-radius:999px;background:rgba(19,22,30,.92);color:#e8eaf2;' +
      'border:1px solid #363d55;font:600 12.5px/1 "DM Sans",system-ui,sans-serif;text-decoration:none;' +
      'box-shadow:0 6px 24px rgba(0,0,0,.35);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);' +
      'transition:transform .15s,border-color .15s}' +
      '#jcr-portal-pill:hover{transform:translateY(-1px);border-color:#4f8ef7}' +
      '#jcr-portal-pill b{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;' +
      'background:linear-gradient(135deg,#4f8ef7,#a78bfa);color:#fff}' +
      '@media print{#jcr-portal-pill{display:none}}';
    document.head.appendChild(st);
    var a = document.createElement('a');
    a.id = 'jcr-portal-pill';
    a.href = ROOT + 'index.html';
    a.title = 'Voltar ao Portal JCR';
    a.innerHTML = '<b><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg></b>Portal';
    document.body.appendChild(a);
  }
  if (document.body) botaoPortal();
  else document.addEventListener('DOMContentLoaded', botaoPortal);
})();
