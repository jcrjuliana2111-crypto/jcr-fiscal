/*
 * JCR Preenchedor — roda dentro da página do formulário (todas as molduras), só quando você clica em
 * "Preencher esta página". Lê os campos, reconhece cada um (mapa.js) e escreve o valor da ficha.
 * Nunca envia o formulário: você confere e avança.
 */
(function () {
  if (self.__jcrPreencher) return;
  const M = self.JcrMapa;
  const limpa = s => String(s ?? '').replace(/\s+/g, ' ').trim();
  const visivel = el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) && getComputedStyle(el).visibility !== 'hidden';
  const textoCurto = el => { const t = limpa(el && (el.innerText || el.textContent)); return t.length && t.length <= 90 ? t : ''; };

  function rotuloDe(el) {
    if (el.id) { try { const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l && textoCurto(l)) return textoCurto(l); } catch (_) { /* id inválido */ } }
    const lab = el.closest('label'); if (lab) { const t = limpa(lab.innerText.replace(el.value || '', '')); if (t && t.length <= 90) return t; }
    const by = el.getAttribute('aria-labelledby');
    if (by) { const t = by.split(/\s+/).map(i => textoCurto(document.getElementById(i))).filter(Boolean).join(' '); if (t) return t; }
    if (el.getAttribute('aria-label')) return limpa(el.getAttribute('aria-label'));
    const td = el.closest('td,th');
    if (td && td.previousElementSibling && textoCurto(td.previousElementSibling)) return textoCurto(td.previousElementSibling);
    // texto logo antes do campo (o próprio campo ou as caixas em volta, até 3 níveis)
    let n = el;
    for (let nivel = 0; nivel < 3 && n; nivel++, n = n.parentElement) {
      let irmao = n.previousElementSibling;
      for (let k = 0; k < 2 && irmao; k++, irmao = irmao.previousElementSibling) {
        if (irmao.matches('input,select,textarea') || irmao.querySelector('input,select,textarea')) break;
        const t = textoCurto(irmao); if (t) return t;
      }
    }
    return limpa(el.getAttribute('title') || '');
  }

  // Títulos da página (para saber se o campo é da sede ou de um sócio)
  function titulos() {
    return [...document.querySelectorAll('h1,h2,h3,h4,h5,h6,legend,caption,th[colspan],.titulo,.title,[class*="titulo"],[class*="header"],[class*="Header"],.panel-heading,.card-header,strong')]
      .map(e => ({ el: e, t: textoCurto(e) })).filter(x => x.t);
  }
  function contextoDe(el, lista) {
    const antes = lista.filter(x => x.el.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING && !x.el.contains(el));
    const fs = el.closest('fieldset'); const legenda = fs && fs.querySelector('legend');
    return [legenda ? textoCurto(legenda) : '', ...antes.slice(-3).reverse().map(x => x.t)].filter(Boolean).join(' | ');
  }

  function descritor(el, lista) {
    const tipo = el.tagName === 'SELECT' ? 'select' : el.tagName === 'TEXTAREA' ? 'textarea' : (el.type || 'text').toLowerCase();
    return {
      rotulo: rotuloDe(el), nome: el.getAttribute('name') || '', id: el.id || '', dica: el.getAttribute('placeholder') || '',
      contexto: lista ? contextoDe(el, lista) : '', tipo, maxlength: el.maxLength > 0 ? el.maxLength : 0,
      opcoes: tipo === 'select' ? [...el.options].map(o => ({ valor: o.value, texto: o.text })) : undefined,
    };
  }

  const SETTER = {
    INPUT: Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set,
    TEXTAREA: Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set,
    SELECT: Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set,
  };
  function escrever(el, valor) {
    el.focus && el.focus();
    SETTER[el.tagName].call(el, valor);
    ['input', 'change', 'keyup', 'blur'].forEach(t => el.dispatchEvent(new Event(t, { bubbles: true })));
  }
  function marcar(el, cor, titulo) { el.style.outline = `2px ${cor === 'ok' ? 'solid #34d399' : 'dashed #fbbf24'}`; el.style.outlineOffset = '1px'; el.title = titulo; }

  self.__jcrPreencher = function (ficha, op = {}) {
    const lista = titulos();
    const campos = [...document.querySelectorAll('input,select,textarea')].filter(el =>
      !el.disabled && !el.readOnly && visivel(el) && !/^(hidden|submit|button|image|reset|file|password|checkbox|radio|search)$/i.test(el.type || ''));
    const ocorrencias = {}; const feitos = []; const sem = [];
    const host = location.host;
    for (const el of campos) {
      const d = descritor(el, lista);
      const aprendida = (op.aprendidos || {})[M.assinatura(host, d)];
      const achado = aprendida ? { chave: aprendida } : M.identificar(d, op.bloco === 'empresa' || op.bloco === 'socio' ? op.bloco : null);
      if (!achado) { if (d.tipo !== 'select' && !el.value) { sem.push(d.rotulo || d.nome || d.id || '(sem nome)'); marcar(el, 'sem', 'JCR: campo não reconhecido — clique com o botão direito para ensinar'); } continue; }
      // vários sócios na mesma página: a 2ª vez que aparece "CPF" é o 2º sócio, e assim por diante
      ocorrencias[achado.chave] = (ocorrencias[achado.chave] || 0) + 1;
      const iSocio = op.socio != null ? +op.socio : ocorrencias[achado.chave] - 1;
      const valor = M.valorDe(ficha, achado.chave, iSocio);
      if (valor == null || valor === '') continue;
      if (el.value && !op.substituir && d.tipo !== 'select') continue;
      const aj = M.ajustarValor(achado.chave, valor, d);
      if (!aj) { sem.push(`${d.rotulo || d.nome} (sem opção para "${valor}")`); marcar(el, 'sem', 'JCR: escolha manualmente'); continue; }
      escrever(el, aj.opcao != null ? aj.opcao : aj.valor);
      marcar(el, 'ok', `JCR: ${M.POR_CHAVE[achado.chave] ? M.POR_CHAVE[achado.chave].rotulo : achado.chave}`);
      feitos.push({ rotulo: d.rotulo || d.nome, chave: achado.chave, valor: aj.opcao != null ? valor : aj.valor });
    }
    return { pagina: location.href, preenchidos: feitos, sem };
  };

  // Para "ensinar" um campo com o botão direito: guarda o último campo clicado
  document.addEventListener('contextmenu', e => {
    const el = e.target && e.target.closest && e.target.closest('input,select,textarea');
    self.__jcrAlvo = el ? { el, d: descritor(el, titulos()) } : null;
  }, true);
  self.__jcrAprender = function (chave, valor) {
    const a = self.__jcrAlvo; if (!a) return null;
    const { el, d } = a;
    if (valor != null && valor !== '') { const aj = M.ajustarValor(chave, valor, d); if (aj) { escrever(el, aj.opcao != null ? aj.opcao : aj.valor); marcar(el, 'ok', 'JCR: ' + chave); } }
    return { assinatura: M.assinatura(location.host, d), rotulo: d.rotulo || d.nome };
  };
})();
