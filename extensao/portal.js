// Roda só nas páginas do Portal JCR: copia a sessão de login do portal para a extensão,
// para ela buscar os processos com o seu usuário (o banco só mostra os seus dados).
(function () {
  const CHAVE = 'sb-onecnoicxqjhgolqncjj-auth-token';
  function enviar() {
    try {
      let s = JSON.parse(localStorage.getItem(CHAVE) || 'null');
      if (s && s.currentSession) s = s.currentSession;
      if (s && s.access_token) chrome.runtime.sendMessage({ tipo: 'sessao', sessao: { access_token: s.access_token, expires_at: s.expires_at, email: s.user && s.user.email } });
    } catch (_) { /* sem sessão */ }
  }
  enviar();
  setInterval(enviar, 60000); // o portal renova o login sozinho; a extensão acompanha
})();
