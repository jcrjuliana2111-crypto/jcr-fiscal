/*
 * Leitor de documentos do Painel Societário (sem tela): transforma o que foi lido de um documento
 * (pela IA, na função ler-documento-societario, ou localmente) em sugestões de preenchimento
 * dos dados do processo, campo por campo, para a pessoa conferir antes de aplicar.
 *
 * Sugestão: { caminho: 'socios.0.cpf', rotulo, atual, novo, marcar, conflito, aviso }
 *   marcar = true quando o campo está vazio; campo já preenchido com valor diferente vem desmarcado.
 *   Campos iguais ao atual não viram sugestão.
 *
 * Tipos de documento: pessoal (RG/CIN/CNH), residencia, iptu, contrato, ficha, cnpj, outro.
 */
(function (root) {
  const limpa = s => String(s ?? '').replace(/\s+/g, ' ').trim();
  const norm = s => limpa(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const digitos = s => String(s ?? '').replace(/\D/g, '');

  function lev(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  const sim = (a, b) => { const x = norm(a), y = norm(b); return 1 - lev(x, y) / Math.max(x.length, y.length, 1); };

  // "10000.00", "10.000,00", "R$ 10.000,00" → 10000
  function numero(s) {
    const t = String(s ?? '').replace(/[^\d.,]/g, '');
    if (!t) return null;
    const v = /,\d{1,2}$/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function pegar(o, caminho) { return caminho.split('.').reduce((x, k) => (x == null ? x : x[k]), o); }
  function por(o, caminho, valor) {
    const ks = caminho.split('.'); let x = o;
    ks.slice(0, -1).forEach((k, i) => { if (x[k] == null) x[k] = /^\d+$/.test(ks[i + 1]) ? [] : {}; x = x[k]; });
    x[ks[ks.length - 1]] = valor;
  }

  const iguais = (a, b) => {
    if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify((a || []).map(norm)) === JSON.stringify((b || []).map(norm));
    if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b);
    if (typeof a === 'boolean' || typeof b === 'boolean') return !!a === !!b;
    return norm(a) === norm(b);
  };
  const vazio = v => v == null || v === '' || (Array.isArray(v) && !v.length);

  // Valores que o formulário já traz de fábrica: o documento substitui sem pedir confirmação
  const PADRAO = { sexo: ['M'], nacionalidade: ['brasileiro'], estado_civil: ['solteiro'], valor_quota: [1], enquadramento: ['ME'], administracao: ['isoladamente'], uf: ['SP'] };
  const ehPadrao = (caminho, atual) => (PADRAO[caminho.split('.').pop()] || []).some(p => iguais(p, atual));

  function sugerir(d, out, caminho, rotulo, novo, extra = {}) {
    if (vazio(novo)) return;
    const atual = pegar(d, caminho);
    if (!vazio(atual) && iguais(atual, novo)) return;
    const livre = vazio(atual) || ehPadrao(caminho, atual);
    out.push({ caminho, rotulo, atual: vazio(atual) ? null : atual, novo, marcar: livre, conflito: !livre, ...extra });
  }

  const nacionalidade = (n, sexo) => {
    const x = norm(n);
    if (/^brasileir/.test(x)) return sexo === 'F' ? 'brasileira' : sexo === 'M' ? 'brasileiro' : limpa(n).toLowerCase();
    return limpa(n).toLowerCase();
  };
  const enderecoTexto = e => [
    limpa(e.logradouro) + (limpa(e.numero) ? ', nº ' + limpa(e.numero) : ''), limpa(e.complemento), limpa(e.bairro),
    [limpa(e.municipio), limpa(e.uf).toUpperCase()].filter(Boolean).join('/'), limpa(e.cep) ? 'CEP ' + limpa(e.cep) : '',
  ].filter(Boolean).join(', ');

  // ── por tipo de documento ──
  function pessoal(d, x, i, out) {
    const k = `socios.${i}`;
    const s = (d.socios || [])[i] || {};
    const sexo = x.sexo || s.sexo;
    sugerir(d, out, k + '.nome', 'Nome', limpa(x.nome));
    if (x.sexo) sugerir(d, out, k + '.sexo', 'Gênero (texto)', x.sexo);
    sugerir(d, out, k + '.cpf', 'CPF', limpa(x.cpf));
    const rg = [limpa(x.rg_numero), [limpa(x.rg_orgao), limpa(x.rg_uf)].filter(Boolean).join('/')].filter(Boolean).join(' ');
    if (limpa(x.rg_numero)) sugerir(d, out, k + '.rg', 'RG e órgão emissor', rg);
    sugerir(d, out, k + '.nascimento', 'Nascimento', limpa(x.data_nascimento));
    sugerir(d, out, k + '.naturalidade', 'Naturalidade', limpa(x.naturalidade));
    if (limpa(x.nacionalidade)) sugerir(d, out, k + '.nacionalidade', 'Nacionalidade', nacionalidade(x.nacionalidade, sexo));
  }

  function residencia(d, x, i, out) {
    const s = (d.socios || [])[i] || {};
    const aviso = limpa(x.titular) && limpa(s.nome) && sim(x.titular, s.nome) < 0.8
      ? `Comprovante em nome de ${limpa(x.titular)}, não do sócio. Se for de cônjuge, pai ou mãe, a JUCESP pode pedir declaração de residência.` : '';
    sugerir(d, out, `socios.${i}.endereco`, 'Endereço residencial', enderecoTexto(x), aviso ? { aviso } : {});
  }

  function iptu(d, x, out) {
    const base = d.tipo === 'alteracao' && d.alteracao && d.alteracao.muda && d.alteracao.muda.endereco ? 'alteracao.endereco_novo' : 'empresa';
    if (base === 'empresa') {
      sugerir(d, out, 'empresa.iptu', 'Inscrição imobiliária (IPTU)', limpa(x.inscricao_imobiliaria));
      sugerir(d, out, 'empresa.area', 'Área do imóvel (m²)', limpa(x.area_construida) || limpa(x.area_terreno));
    }
    [['logradouro', 'Logradouro'], ['numero', 'Número'], ['complemento', 'Complemento'], ['bairro', 'Bairro'], ['municipio', 'Município'], ['uf', 'UF'], ['cep', 'CEP']]
      .forEach(([c, r]) => sugerir(d, out, `${base}.${c}`, (base === 'empresa' ? 'Sede — ' : 'Novo endereço — ') + r, c === 'uf' ? limpa(x[c]).toUpperCase() : limpa(x[c])));
  }

  // Sócio do documento → índice no formulário (pelo CPF; senão pelo nome; senão um novo no fim)
  function indiceSocio(socios, s, usados) {
    const cpf = digitos(s.cpf);
    let i = cpf.length === 11 ? socios.findIndex((x, j) => !usados.has(j) && digitos(x.cpf) === cpf) : -1;
    if (i < 0) i = socios.findIndex((x, j) => !usados.has(j) && limpa(x.nome) && sim(x.nome, s.nome) >= 0.85);
    if (i < 0) i = socios.findIndex((x, j) => !usados.has(j) && !limpa(x.nome) && !limpa(x.cpf));
    return i;
  }

  function empresa(d, x, out) {
    const transf = d.tipo === 'transformacao';
    const ehEi = /empres[aá]rio|individual|\bmei\b/i.test(x.natureza_juridica || '') || (limpa(x.nome_empresarial) && !/\bltda\b|limitada/i.test(x.nome_empresarial));
    sugerir(d, out, transf && ehEi ? 'empresa.nome_ei' : 'empresa.nome', transf && ehEi ? 'Nome empresarial atual (empresa individual)' : 'Nome empresarial', limpa(x.nome_empresarial));
    sugerir(d, out, 'empresa.cnpj', 'CNPJ', limpa(x.cnpj));
    sugerir(d, out, 'empresa.nire', 'NIRE', limpa(x.nire));
    if (d.tipo !== 'constituicao') sugerir(d, out, 'empresa.inicio', 'Início das atividades', limpa(x.data_inicio));
    [['logradouro', 'Logradouro'], ['numero', 'Número'], ['complemento', 'Complemento'], ['bairro', 'Bairro'], ['municipio', 'Município'], ['uf', 'UF'], ['cep', 'CEP']]
      .forEach(([c, r]) => sugerir(d, out, `empresa.${c}`, 'Sede — ' + r, c === 'uf' ? limpa(x[c]).toUpperCase() : limpa(x[c])));
    sugerir(d, out, 'empresa.objeto', 'Atividades', (x.objeto || []).map(limpa).filter(Boolean));
    sugerir(d, out, 'empresa.capital', 'Capital social (R$)', numero(x.capital));
    sugerir(d, out, 'empresa.valor_quota', 'Valor da quota (R$)', numero(x.valor_quota));
    if (x.enquadramento) sugerir(d, out, 'empresa.enquadramento', 'Enquadramento', x.enquadramento);
    if (x.administracao) sugerir(d, out, 'empresa.administracao', 'Administradores agem', x.administracao);
    sugerir(d, out, 'empresa.foro', 'Foro (comarca)', limpa(x.foro));
    if (d.tipo === 'alteracao' && numero(x.numero_ultima_alteracao)) sugerir(d, out, 'numero_alteracao', 'Nº desta alteração (a seguinte à do documento)', String(numero(x.numero_ultima_alteracao) + 1));

    const socios = d.socios || [];
    const usados = new Set();
    let novo = socios.length;
    (x.socios || []).slice(0, transf ? 1 : undefined).forEach(s => {
      let i = transf ? 0 : indiceSocio(socios, s, usados);
      if (i < 0) i = novo++;
      usados.add(i);
      const k = `socios.${i}`, quem = limpa(s.nome) || `sócio ${i + 1}`;
      const r = t => `${quem} — ${t}`;
      sugerir(d, out, k + '.nome', r('Nome'), limpa(s.nome), { socio_novo: i >= socios.length });
      sugerir(d, out, k + '.nacionalidade', r('Nacionalidade'), limpa(s.nacionalidade).toLowerCase());
      sugerir(d, out, k + '.estado_civil', r('Estado civil'), limpa(s.estado_civil).toLowerCase());
      sugerir(d, out, k + '.regime_bens', r('Regime de bens'), limpa(s.regime_bens).toLowerCase());
      sugerir(d, out, k + '.profissao', r('Profissão'), limpa(s.profissao).toLowerCase());
      sugerir(d, out, k + '.nascimento', r('Nascimento'), limpa(s.data_nascimento));
      sugerir(d, out, k + '.naturalidade', r('Naturalidade'), limpa(s.naturalidade));
      sugerir(d, out, k + '.rg', r('RG e órgão emissor'), limpa(s.rg));
      sugerir(d, out, k + '.cpf', r('CPF'), limpa(s.cpf));
      sugerir(d, out, k + '.endereco', r('Endereço residencial'), limpa(s.endereco));
      if (!transf) {
        sugerir(d, out, k + '.quotas', r('Quotas'), numero(s.quotas));
        if (s.administrador) sugerir(d, out, k + '.administrador', r('Administrador'), true);
      }
    });
  }

  function propostas(tipoDoc, extraido, d, socio = 0) {
    const out = [];
    const x = extraido || {};
    if (tipoDoc === 'pessoal') pessoal(d, x, socio, out);
    else if (tipoDoc === 'residencia') residencia(d, x, socio, out);
    else if (tipoDoc === 'iptu') iptu(d, x, out);
    else empresa(d, x, out);
    return out;
  }

  // Aplica as sugestões escolhidas; sócio novo entra com os valores padrão do formulário
  function aplicar(d, sugestoes, socioPadrao) {
    sugestoes.forEach(s => {
      const m = s.caminho.match(/^socios\.(\d+)\./);
      if (m && socioPadrao) while ((d.socios || (d.socios = [])).length <= +m[1]) d.socios.push(socioPadrao(d));
      por(d, s.caminho, s.novo);
    });
    return d;
  }

  // ── leitura local (sem IA) dos formulários gerados pela JUCESP (VRE) ──
  // Recebe as páginas já em texto (Conferidor.linhasDePagina) e a função campo() do conferidor.
  // Devolve no mesmo formato da leitura por IA ("empresa"), ou null se não houver formulário da JUCESP.
  const cnae = c => `${c.slice(0, 4)}-${c.slice(4, 5)}/${c.slice(5)}`;
  function lerFormulariosJucesp(paginas, campo) {
    const v = (p, r) => limpa(campo(p.texto, r) || '');
    const ficha = paginas.find(p => /Ficha Cadastral - Modelo/i.test(p.texto));
    const quadros = paginas.filter(p => /Ficha Cadastral - Quadro Societ/i.test(p.texto));
    const req = paginas.find(p => /Requerimento de Empres/i.test(p.texto));
    if (!ficha && !quadros.length && !req) return null;
    const x = { nome_empresarial: '', cnpj: '', nire: '', natureza_juridica: '', data_inicio: '', logradouro: '', numero: '', complemento: '', bairro: '',
      municipio: '', uf: '', cep: '', objeto: [], capital: '', valor_quota: '', enquadramento: '', administracao: '', foro: '', numero_ultima_alteracao: '', socios: [] };
    const base = ficha || req;
    if (base) {
      x.nome_empresarial = v(base, 'NOME EMPRESARIAL');
      x.logradouro = v(base, ficha ? 'LOGRADOURO' : 'LOGRADOURO (rua, av, etc.)') || v(base, 'LOGRADOURO');
      x.numero = v(base, 'NÚMERO'); x.complemento = v(base, 'COMPLEMENTO'); x.bairro = v(base, 'BAIRRO/DISTRITO');
      x.cep = v(base, 'CEP'); x.municipio = v(base, 'MUNICIPIO'); x.uf = v(base, 'UF');
    }
    if (ficha) {
      x.cnpj = v(ficha, 'CNPJ SEDE'); x.nire = v(ficha, 'NIRE SEDE'); x.natureza_juridica = v(ficha, 'TIPO JURIDICO');
      x.data_inicio = v(ficha, 'INICIO DAS ATIVIDADES');
      const porte = v(ficha, 'PORTE').toUpperCase(); if (porte === 'ME' || porte === 'EPP') x.enquadramento = porte;
      x.objeto = [...ficha.texto.matchAll(/^\s*(\d{7})\s+-\s+(.+?)\s*$/gm)].map(m => `${limpa(m[2])} (CNAE ${cnae(m[1])})`);
      const cap = ficha.texto.match(/Valor do Capital:\s*R\$\s*([\d.,]+)/i); if (cap) x.capital = String(numero(cap[1]));
    }
    if (req) {
      // o requerimento tem dois endereços: do empresário (antes de "ATO(S)") e da empresa (depois de "NOME EMPRESARIAL")
      const iAto = req.texto.search(/ATO\(S\)/), iEmp = req.texto.search(/NOME EMPRESARIAL/);
      const pessoa = { texto: iAto > 0 ? req.texto.slice(0, iAto) : req.texto };
      const emp = { texto: iEmp > 0 ? req.texto.slice(iEmp) : req.texto };
      x.logradouro = v(emp, 'LOGRADOURO (rua, av, etc.)') || x.logradouro; x.numero = v(emp, 'NÚMERO'); x.complemento = v(emp, 'COMPLEMENTO');
      x.bairro = v(emp, 'BAIRRO/DISTRITO'); x.cep = v(emp, 'CEP'); x.municipio = v(emp, 'MUNICIPIO'); x.uf = v(emp, 'UF');
      x.natureza_juridica = x.natureza_juridica || 'Empresário (Individual)';
      const nire = v(req, 'NÚMERO DE IDENTIFICAÇÃO DO REGISTRO DE EMPRESA - NIRE DA SEDE'); if (nire && !x.nire) x.nire = nire;
      const cnpj = (req.texto.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/) || [''])[0]; if (cnpj && !x.cnpj) x.cnpj = cnpj;
      const rg = [v(pessoa, 'IDENTIDADE (número)'), [v(pessoa, 'ORGAO EMISSOR'), v(pessoa, 'UF')].filter(Boolean).join('/')].filter(Boolean).join(' ');
      const end = [v(pessoa, 'DOMICILIADO NA (logradouro - rua, av, etc.)') + (v(pessoa, 'NÚMERO') ? ', nº ' + v(pessoa, 'NÚMERO') : ''), v(pessoa, 'COMPLEMENTO'), v(pessoa, 'BAIRRO/DISTRITO'),
        [v(pessoa, 'MUNICIPIO'), v(pessoa, 'UF')].filter(Boolean).join('/'), v(pessoa, 'CEP') && 'CEP ' + v(pessoa, 'CEP')].filter(Boolean).join(', ');
      const natural = [v(pessoa, 'NATURAL DE (cidade e sigla do estado)')].filter(Boolean).join('');
      x.socios.push({ nome: v(pessoa, 'NOME DO EMPRESÁRIO (completo, sem abreviaturas)'), nacionalidade: v(pessoa, 'NACIONALIDADE'), estado_civil: v(pessoa, 'ESTADO CIVIL').replace(/\(a\)$/, '').toLowerCase(),
        regime_bens: v(pessoa, 'REGIME DE BENS (se casado)'), profissao: '', data_nascimento: v(pessoa, 'NASCIDO EM (data de nascimento)'), rg, cpf: v(pessoa, 'CPF (número)'), naturalidade: natural,
        endereco: end, quotas: '', administrador: true });
    }
    quadros.forEach(q => {
      const nome = v(q, 'NOME DO INTEGRANTE'); if (!nome || x.socios.some(s => sim(s.nome, nome) > 0.9)) return;
      const participa = (q.texto.match(/Participa[cç][aã]o no Capital:?\s*R\$\s*([\d.,]+)/i) || [])[1];
      x.socios.push({ nome, nacionalidade: v(q, 'NACIONALIDADE'), estado_civil: '', regime_bens: '', profissao: '', data_nascimento: '',
        rg: [v(q, 'RG/RNE'), v(q, 'ORGÃO EMISSOR') || v(q, 'ÓRGÃO EMISSOR')].filter(Boolean).join(' '), cpf: v(q, 'IDENTIFICAÇÃO'),
        endereco: [v(q, 'LOGRADOURO (rua, av, etc)') + (v(q, 'NÚMERO') ? ', nº ' + v(q, 'NÚMERO') : ''), v(q, 'BAIRRO/DISTRITO'), v(q, 'MUNICIPIO'), v(q, 'CEP') && 'CEP ' + v(q, 'CEP')].filter(Boolean).join(', '),
        quotas: participa && numero(participa) != null ? '' : '', administrador: /Administrador/i.test(q.texto) });
    });
    return x;
  }

  const TIPOS_DOC = {
    pessoal: 'RG / CIN / CNH do sócio',
    residencia: 'Comprovante de residência do sócio',
    iptu: 'Carnê do IPTU',
    contrato: 'Contrato social ou última alteração',
    ficha: 'Ficha cadastral da JUCESP',
    cnpj: 'Cartão CNPJ',
    outro: 'Outro documento da empresa',
  };
  const DO_SOCIO = new Set(['pessoal', 'residencia']);

  const api = { propostas, aplicar, numero, sim, lerFormulariosJucesp, TIPOS_DOC, DO_SOCIO };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LeitorSoc = api;
})(typeof window !== 'undefined' ? window : globalThis);
