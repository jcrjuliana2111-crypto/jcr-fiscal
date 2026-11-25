/*
 * Corrigir exigência: compara o que saiu nos PDFs enviados à JUCESP (ficha, quadro societário, requerimento)
 * com os dados certos do processo ("Dados e documentos", que vêm dos documentos dos sócios, IPTU e ficha)
 * e monta a lista de correções. As correções ficam salvas no processo (dados.correcoes) para o
 * JCR Preenchedor substituir só esses campos no formulário do governo.
 * Funções puras, testadas em tests/exigencia.test.js.
 */
(function (root) {
  const L = root.LeitorSoc || (typeof require !== 'undefined' ? require('./leitor-core.js') : null);
  const copia = o => JSON.parse(JSON.stringify(o || {}));
  const vazio = v => v == null || v === '' || (Array.isArray(v) && !v.length);
  const texto = v => (Array.isArray(v) ? v.join('; ') : v == null ? '' : String(v));
  const IGNORAR = new Set(['numero_alteracao', 'empresa.foro', 'empresa.administracao', 'empresa.valor_quota']);

  /*
   * Diferenças entre os dados do processo e o que foi lido dos PDFs.
   * escolha: 'documento' = os dados do processo estão certos e o formulário deve ser corrigido;
   *          'pdf'       = o PDF traz um dado que falta no processo (traz para os dados).
   */
  function diferencas(dados, extraido) {
    if (!extraido) return [];
    return L.propostas('ficha', extraido, copia(dados))
      .filter(s => !IGNORAR.has(s.caminho))
      // só formato diferente (maiúsculas, acento, "nº", "/SP", pontuação do NIRE/CNAE) não é erro
      .filter(s => s.socio_novo || vazio(s.atual) || !mesmoConteudo(s.atual, s.novo))
      .map(s => {
        const faltaNosDados = vazio(s.atual) || (!s.conflito && s.marcar);
        return {
          caminho: s.caminho, rotulo: s.rotulo, certo: s.atual, noPdf: s.novo,
          tipo: s.socio_novo ? 'socio_so_no_pdf' : faltaNosDados ? 'so_no_pdf' : 'divergente',
          escolha: faltaNosDados && !s.socio_novo ? 'pdf' : 'documento',
          sugestao: s,
        };
      });
  }

  const UFS = new Set('ac al ap am ba ce df es go ma mt ms mg pa pb pr pe pi rj rn rs ro rr sc sp se to'.split(' '));
  const normal = v => texto(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/n[º°o]\.?\s/g, ' ').replace(/(\d)[.\-/](?=\d)/g, '$1').replace(/[^a-z0-9]+/g, ' ')
    .split(' ').filter(t => t && t !== 'n' && !UFS.has(t)).join(' ');
  const cnaes = v => (texto(v).match(/\d{2}\.?\d{2}-?\d[-/]?\d{2}/g) || []).map(c => c.replace(/\D/g, '')).sort().join(',');
  // Mesmo conteúdo com escrita diferente? Listas de atividades comparam os códigos CNAE.
  function mesmoConteudo(a, b) {
    const ca = cnaes(a), cb = cnaes(b);
    if (ca && cb) return ca === cb;
    return normal(a) === normal(b);
  }

  // Campos que podem ser corrigidos à mão (quando o PDF e os dados estavam errados)
  function camposManuais(dados) {
    const d = dados || {};
    const emp = [['empresa.nome', 'Nome empresarial'], ['empresa.nome_ei', 'Nome da empresa individual'], ['empresa.cnpj', 'CNPJ'], ['empresa.nire', 'NIRE'],
      ['empresa.logradouro', 'Sede — Logradouro'], ['empresa.numero', 'Sede — Número'], ['empresa.complemento', 'Sede — Complemento'], ['empresa.bairro', 'Sede — Bairro'],
      ['empresa.municipio', 'Sede — Município'], ['empresa.cep', 'Sede — CEP'], ['empresa.iptu', 'Inscrição imobiliária'], ['empresa.area', 'Área (m²)'],
      ['empresa.capital', 'Capital social (R$)'], ['empresa.inicio', 'Início das atividades'], ['empresa.enquadramento', 'Porte (ME/EPP)']];
    const soc = (d.socios || []).flatMap((s, i) => {
      const q = (s.nome || `Sócio ${i + 1}`) + ' — ';
      return [['nome', 'Nome'], ['cpf', 'CPF'], ['rg', 'RG e órgão emissor'], ['nascimento', 'Nascimento'], ['estado_civil', 'Estado civil'], ['regime_bens', 'Regime de bens'],
        ['profissao', 'Profissão'], ['nacionalidade', 'Nacionalidade'], ['naturalidade', 'Naturalidade'], ['endereco', 'Endereço residencial'], ['quotas', 'Quotas']]
        .map(([c, r]) => [`socios.${i}.${c}`, q + r]);
    });
    return [...emp, ...soc].map(([caminho, rotulo]) => ({ caminho, rotulo, atual: texto(pegar(d, caminho)) }));
  }
  function pegar(o, caminho) { return caminho.split('.').reduce((x, k) => (x == null ? x : x[k]), o); }
  function por(o, caminho, valor) {
    const ks = caminho.split('.'); let x = o;
    ks.slice(0, -1).forEach((k, i) => { if (x[k] == null) x[k] = /^\d+$/.test(ks[i + 1]) ? [] : {}; x = x[k]; });
    x[ks[ks.length - 1]] = valor;
  }

  /*
   * Aplica as escolhas e registra as correções no processo.
   *   difs: saída de diferencas() com a escolha de cada linha
   *   manuais: [{ caminho, rotulo, valor }] — valor certo digitado à mão
   * Devolve { dados, correcoes } — dados.correcoes = { exigencia, em, itens: [{ caminho, rotulo, errado, certo }] }
   */
  function registrar(dados, difs, manuais, exigencia, hoje, socioPadrao) {
    const d = copia(dados);
    const itens = [];
    const doPdf = (difs || []).filter(x => x.escolha === 'pdf').map(x => ({ ...x.sugestao, marcar: true }));
    if (doPdf.length) L.aplicar(d, doPdf, socioPadrao);
    (difs || []).filter(x => x.escolha === 'documento' && x.tipo === 'divergente')
      .forEach(x => itens.push({ caminho: x.caminho, rotulo: x.rotulo, errado: texto(x.noPdf), certo: texto(x.certo) }));
    (manuais || []).filter(m => m.caminho && !vazio(m.valor)).forEach(m => {
      const antes = texto(pegar(d, m.caminho));
      por(d, m.caminho, /capital|quotas$/.test(m.caminho) && /^[\d.,]+$/.test(m.valor) ? L.numero(m.valor) : m.valor);
      const i = itens.findIndex(x => x.caminho === m.caminho);
      const item = { caminho: m.caminho, rotulo: m.rotulo || m.caminho, errado: i >= 0 ? itens[i].errado : antes, certo: texto(m.valor) };
      if (i >= 0) itens[i] = item; else itens.push(item);
    });
    const correcoes = { exigencia: String(exigencia || '').trim(), em: hoje, itens };
    d.correcoes = correcoes;
    return { dados: d, correcoes };
  }

  // Texto para registrar no processo (observações) e mandar ao cliente, se preciso
  function resumo(correcoes) {
    const c = correcoes || { itens: [] };
    return [`Correções da exigência (${c.em ? c.em.split('-').reverse().join('/') : ''}):`, c.exigencia ? `Exigência: ${c.exigencia}` : '',
      ...c.itens.map(i => `• ${i.rotulo}: era "${i.errado || '—'}", correto "${i.certo}"`)].filter(Boolean).join('\n');
  }

  const api = { diferencas, camposManuais, registrar, resumo, mesmoConteudo };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ExigenciaSoc = api;
})(typeof window !== 'undefined' ? window : globalThis);
