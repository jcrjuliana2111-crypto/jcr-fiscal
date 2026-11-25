/*
 * JCR Preenchedor — o "cérebro" da extensão.
 * 1) Monta a ficha (chave → valor) a partir do processo salvo no portal (soc_processos.dados, o mesmo
 *    "Dados e documentos" que gera o contrato) e do cadastro do cliente.
 * 2) Reconhece cada campo de um formulário do governo pelo texto que aparece na tela (rótulo, dica,
 *    nome do campo) e pelo bloco em que ele está (sede da empresa x sócio).
 * 3) Ajusta o valor ao campo (só números, data, opção de lista).
 * Funções puras, sem acesso à página; testadas em tests/extensao.test.js.
 */
(function (root) {
  const semAcento = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const limpa = s => String(s ?? '').replace(/\s+/g, ' ').trim();
  const digitos = s => String(s ?? '').replace(/\D/g, '');

  // ── catálogo de campos: chave, rótulo e como eles aparecem nos formulários ──
  // escopo: 'empresa' (sede/estabelecimento), 'socio' (integrante, titular, administrador) ou 'ato'
  const CAMPOS = [
    ['empresa.nome', 'Nome empresarial', 'empresa', [/nome empresarial/, /razao social/, /nome da (empresa|sociedade|pessoa juridica)/, /^empresa$/]],
    ['empresa.nome_fantasia', 'Nome fantasia', 'empresa', [/nome fantasia/, /titulo do estabelecimento/]],
    ['empresa.cnpj', 'CNPJ', 'empresa', [/\bcnpj\b/]],
    ['empresa.nire', 'NIRE', 'empresa', [/\bnire\b/]],
    ['empresa.cep', 'CEP da sede', 'empresa', [/\bcep\b/]],
    ['empresa.logradouro', 'Logradouro da sede', 'empresa', [/logradouro/, /^endereco$/, /^rua$/, /nome do logradouro/]],
    ['empresa.numero', 'Número da sede', 'empresa', [/^numero$/, /^n[o°º]\.?$/, /numero do (imovel|logradouro|endereco)/]],
    ['empresa.complemento', 'Complemento da sede', 'empresa', [/complemento/]],
    ['empresa.bairro', 'Bairro da sede', 'empresa', [/bairro/, /^distrito$/]],
    ['empresa.municipio', 'Município da sede', 'empresa', [/municipio/, /^cidade$/]],
    ['empresa.uf', 'UF da sede', 'empresa', [/^uf$/, /^estado$/, /unidade da federacao/]],
    ['empresa.iptu', 'Inscrição imobiliária (IPTU)', 'empresa', [/inscricao imobiliaria/, /\biptu\b/, /cadastro imobiliario/, /numero do contribuinte/, /^sql$/, /codigo do imovel/]],
    ['empresa.area', 'Área do estabelecimento (m²)', 'empresa', [/area (utilizada|do estabelecimento|construida|total|ocupada)/, /^area( m2)?$/, /metragem/]],
    ['empresa.capital', 'Capital social (R$)', 'empresa', [/capital social/, /valor do capital/, /^capital$/]],
    ['empresa.valor_quota', 'Valor de cada quota', 'empresa', [/valor (de cada |da |unitario da )?quota/]],
    ['empresa.total_quotas', 'Quantidade total de quotas', 'empresa', [/(quantidade|numero|total) de quotas/]],
    ['empresa.objeto', 'Objeto social', 'empresa', [/objeto social/, /^objeto$/, /descricao (do objeto|das atividades)/]],
    ['empresa.cnae_principal', 'CNAE principal', 'empresa', [/(cnae|atividade|codigo) principal/, /^cnae$/, /cnae fiscal/]],
    ['empresa.cnaes_secundarios', 'CNAEs secundários', 'empresa', [/(cnaes?|atividades?) secundari/]],
    ['empresa.email', 'E-mail da empresa', 'empresa', [/e-?mail/, /correio eletronico/]],
    ['empresa.telefone', 'Telefone da empresa', 'empresa', [/telefone/, /celular/, /\bddd\b/, /fone/]],
    ['empresa.inicio', 'Data de início das atividades', 'empresa', [/inicio (das )?atividades/, /data de inicio/]],
    ['empresa.enquadramento', 'Porte (ME/EPP)', 'empresa', [/enquadramento/, /^porte$/, /porte da empresa/]],
    ['ato.nome_novo', 'Novo nome empresarial', 'ato', [/novo nome/, /nome empresarial (novo|pretendido)/]],
    ['ato.data_encerramento', 'Data do encerramento', 'ato', [/data (do |de )?(encerramento|extincao|distrato)/]],
    ['ato.livros_nome', 'Responsável pela guarda dos livros', 'ato', [/guarda dos livros/, /responsavel pel[ao]s? (livros|acervo|documentos)/]],
    ['ato.livros_endereco', 'Endereço da guarda dos livros', 'ato', [/endereco (da guarda|dos livros|do acervo)/]],
    ['socio.nome', 'Nome do sócio', 'socio', [/nome (completo|do socio|do titular|do empresario|do integrante|do administrador|civil)/, /^nome$/]],
    ['socio.cpf', 'CPF', 'socio', [/\bcpf\b/]],
    ['socio.rg', 'RG (número)', 'socio', [/\brg\b/, /identidade/, /documento de identificacao/, /numero do documento/]],
    ['socio.rg_orgao', 'Órgão emissor', 'socio', [/orgao (emissor|expedidor)/]],
    ['socio.rg_uf', 'UF do órgão emissor', 'socio', [/uf (do orgao|emissor|expedidor|do documento)/]],
    ['socio.nascimento', 'Data de nascimento', 'socio', [/(data de )?nascimento/]],
    ['socio.sexo', 'Sexo', 'socio', [/^sexo$/, /^genero$/]],
    ['socio.nacionalidade', 'Nacionalidade', 'socio', [/nacionalidade/]],
    ['socio.naturalidade', 'Naturalidade', 'socio', [/naturalidade/, /local de nascimento/]],
    ['socio.estado_civil', 'Estado civil', 'socio', [/estado civil/]],
    ['socio.regime_bens', 'Regime de bens', 'socio', [/regime (de|do) (bens|casamento)/]],
    ['socio.profissao', 'Profissão', 'socio', [/profissao/, /ocupacao/]],
    ['socio.quotas', 'Quotas do sócio', 'socio', [/quotas/, /(numero|quantidade) de cotas/]],
    ['socio.valor_participacao', 'Valor da participação (R$)', 'socio', [/valor (da )?participacao/, /capital (do socio|integralizado)/]],
    ['socio.administrador', 'É administrador?', 'socio', [/administrador/]],
    ['socio.cep', 'CEP do sócio', 'socio', [/\bcep\b/]],
    ['socio.logradouro', 'Logradouro do sócio', 'socio', [/logradouro/, /^endereco( residencial)?$/, /^rua$/]],
    ['socio.numero', 'Número (sócio)', 'socio', [/^numero$/, /^n[o°º]\.?$/]],
    ['socio.complemento', 'Complemento (sócio)', 'socio', [/complemento/]],
    ['socio.bairro', 'Bairro (sócio)', 'socio', [/bairro/]],
    ['socio.municipio', 'Município (sócio)', 'socio', [/municipio/, /^cidade$/]],
    ['socio.uf', 'UF (sócio)', 'socio', [/^uf$/, /^estado$/]],
  ].map(([chave, rotulo, escopo, padroes]) => ({ chave, rotulo, escopo, padroes }));
  const POR_CHAVE = Object.fromEntries(CAMPOS.map(c => [c.chave, c]));

  // Bloco do formulário pelo título ao redor do campo
  const RE_SOCIO = /s[o]cio|integrante|titular|administrador|qsa|quadro societario|pessoa fisica|residencial|representante|responsavel legal|empresario|cedente|cessionario/;
  const RE_EMPRESA = /estabelecimento|sede|matriz|filial|imovel|endereco da empresa|dados da empresa|pessoa juridica|localizacao/;
  function bloco(contexto) {
    const c = semAcento(contexto);
    const s = c.search(RE_SOCIO), e = c.search(RE_EMPRESA);
    if (s < 0 && e < 0) return null;
    if (s < 0) return 'empresa'; if (e < 0) return 'socio';
    return s < e ? 'socio' : 'empresa'; // o título mais próximo vem primeiro no contexto
  }

  /*
   * Reconhece o campo. d = { rotulo, nome, id, dica, contexto, tipo }
   * Devolve { chave, pontos } ou null. Rótulo vale mais que nome técnico.
   * forcar = 'empresa' | 'socio' para preencher só um bloco.
   */
  function identificar(d, forcar) {
    const rot = semAcento(limpa(d.rotulo)).replace(/[*:]+$/g, '').replace(/\s*\(.*?\)\s*/g, ' ').trim();
    // nome técnico em palavras: "txtCpfSocio" e "cep_estabelecimento" → "txt cpf socio", "cep estabelecimento"
    const tec = semAcento([d.nome, d.id].filter(Boolean).join(' ').replace(/([a-z])([A-Z])/g, '$1 $2')).replace(/[^a-z0-9]+/g, ' ').trim();
    const palavras = tec ? tec.split(' ') : [];
    const dica = semAcento(limpa(d.dica));
    const blk = forcar || bloco(d.contexto || '') || bloco(tec);
    let melhor = null;
    for (const c of CAMPOS) {
      let pts = 0;
      for (const p of c.padroes) {
        if (rot && p.test(rot)) pts = Math.max(pts, p.source.startsWith('^') ? 10 : 8);
        else if (dica && p.test(dica)) pts = Math.max(pts, 5);
        else if (tec && (p.test(tec) || palavras.some(w => p.test(w)))) pts = Math.max(pts, 5);
      }
      if (!pts) continue;
      if (c.escopo !== 'ato') {
        if (blk && c.escopo === blk) pts += 3;
        else if (blk && c.escopo !== blk) pts -= 4;
        else if (!blk && c.escopo === 'socio' && /^(socio\.(nome|cep|logradouro|numero|complemento|bairro|municipio|uf))$/.test(c.chave)) pts -= 1;
      }
      if (forcar && c.escopo !== 'ato' && c.escopo !== forcar) continue;
      if (pts > 0 && (!melhor || pts > melhor.pontos)) melhor = { chave: c.chave, pontos: pts };
    }
    return melhor && melhor.pontos >= 4 ? melhor : null;
  }

  // ── ficha do processo ──
  // "Rua A, nº 1, apto 2, Centro, Campinas/SP, CEP 13010-000" → partes
  function partirEndereco(texto) {
    const t = limpa(texto); if (!t) return {};
    const out = {};
    const cep = /(\d{5})-?(\d{3})/.exec(t); if (cep) out.cep = `${cep[1]}-${cep[2]}`;
    let resto = t.replace(/,?\s*CEP:?\s*\d{5}-?\d{3}/i, '').replace(/\d{5}-?\d{3}/, '').replace(/[,\s]+$/, '');
    const cid = /([^,]+?)\s*[\/-]\s*([A-Z]{2})\s*$/.exec(resto.trim());
    if (cid) { out.municipio = limpa(cid[1]); out.uf = cid[2]; resto = resto.trim().slice(0, cid.index); }
    const partes = resto.split(',').map(limpa).filter(Boolean);
    if (partes.length) out.logradouro = partes.shift();
    const iNum = partes.findIndex(p => /^(n[ºo°.]*\s*)?\d+[\w-]*$/i.test(p) || /^s\/?n$/i.test(p));
    if (iNum >= 0) { out.numero = partes[iNum].replace(/^n[ºo°.]*\s*/i, ''); partes.splice(iNum, 1); }
    if (partes.length) out.bairro = partes.pop();
    if (partes.length) out.complemento = partes.join(', ');
    return out;
  }
  // "1.111.111 SSP/SP" → { numero, orgao, uf }
  function partirRg(texto) {
    const t = limpa(texto); if (!t) return {};
    const m = /^(.*?)[\s-]+([A-Za-z]{2,8})\s*[\/-]\s*([A-Z]{2})$/.exec(t);
    return m ? { numero: limpa(m[1]), orgao: m[2].toUpperCase(), uf: m[3] } : { numero: t };
  }
  const cnaes = objeto => {
    const out = [];
    (Array.isArray(objeto) ? objeto : [objeto]).forEach(l => { const re = /(\d{2})\.?(\d{2})-?(\d)[\/-]?(\d{2})/g; let m; while ((m = re.exec(String(l || '')))) out.push(`${m[1]}${m[2]}-${m[3]}/${m[4]}`); });
    return [...new Set(out)];
  };
  const moeda = v => (v == null || v === '' ? '' : (+v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

  /*
   * processo = linha de soc_processos ({ empresa, tipo, municipio, dados }), cliente = gclik_clientes (opcional)
   * Devolve { empresa: {chave: valor}, ato: {...}, socios: [{chave: valor}], titulo }
   */
  function montarFicha(processo, cliente) {
    const p = processo || {}, d = p.dados || {}, e = d.empresa || {}, alt = d.alteracao || {}, muda = alt.muda || {}, ds = d.distrato || {};
    const cl = cliente || {};
    const sede = muda.endereco && alt.endereco_novo && alt.endereco_novo.logradouro ? { ...e, ...alt.endereco_novo } : e;
    const objeto = (muda.objeto && (alt.objeto_novo || []).length ? alt.objeto_novo : e.objeto) || [];
    const capital = muda.capital && alt.capital_novo ? alt.capital_novo : e.capital;
    const lista = cnaes(objeto);
    const totalQuotas = (d.socios || []).filter(s => s.situacao !== 'sai').reduce((s, x) => s + (+x.quotas || 0), 0);
    const empresa = {
      'empresa.nome': limpa(e.nome || p.empresa || e.nome_ei), 'empresa.nome_fantasia': limpa(e.nome_fantasia || e.fantasia || cl.nome_fantasia),
      'empresa.cnpj': e.cnpj || cl.cnpj, 'empresa.nire': e.nire, 'empresa.cep': sede.cep, 'empresa.logradouro': sede.logradouro, 'empresa.numero': sede.numero,
      'empresa.complemento': sede.complemento, 'empresa.bairro': sede.bairro, 'empresa.municipio': sede.municipio || p.municipio, 'empresa.uf': sede.uf || 'SP',
      'empresa.iptu': sede.iptu || e.iptu, 'empresa.area': sede.area || e.area, 'empresa.capital': moeda(capital), 'empresa.valor_quota': moeda(e.valor_quota),
      'empresa.total_quotas': totalQuotas || '', 'empresa.objeto': objeto.map(limpa).join('; '), 'empresa.cnae_principal': lista[0] || '',
      'empresa.cnaes_secundarios': lista.slice(1).join(', '), 'empresa.email': cl.email, 'empresa.telefone': cl.telefone, 'empresa.inicio': e.inicio,
      'empresa.enquadramento': e.enquadramento,
    };
    const ato = { 'ato.nome_novo': muda.nome ? alt.nome_novo : '', 'ato.data_encerramento': ds.data_encerramento, 'ato.livros_nome': ds.livros_nome, 'ato.livros_endereco': ds.livros_endereco };
    const valorQuota = +e.valor_quota || 1;
    const socios = (d.socios || []).filter(s => s.situacao !== 'sai' || p.tipo === 'alteracao').map(s => {
      const end = partirEndereco(s.endereco), rg = partirRg(s.rg);
      return {
        'socio.nome': limpa(s.nome), 'socio.cpf': s.cpf, 'socio.rg': rg.numero, 'socio.rg_orgao': rg.orgao, 'socio.rg_uf': rg.uf,
        'socio.nascimento': s.nascimento, 'socio.sexo': s.sexo === 'F' ? 'Feminino' : s.sexo === 'M' ? 'Masculino' : '', 'socio.nacionalidade': s.nacionalidade,
        'socio.naturalidade': s.naturalidade, 'socio.estado_civil': s.estado_civil, 'socio.regime_bens': s.regime_bens, 'socio.profissao': s.profissao,
        'socio.quotas': s.quotas || '', 'socio.valor_participacao': s.quotas ? moeda(s.quotas * valorQuota) : '', 'socio.administrador': s.administrador ? 'Sim' : 'Não',
        'socio.cep': end.cep, 'socio.logradouro': end.logradouro, 'socio.numero': end.numero, 'socio.complemento': end.complemento,
        'socio.bairro': end.bairro, 'socio.municipio': end.municipio, 'socio.uf': end.uf,
      };
    });
    const limpar = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && String(v).trim() !== '').map(([k, v]) => [k, String(v)]));
    // Correções de exigência (registradas no Conferidor): campos que devem ser trocados no formulário
    const corr = (d.correcoes && d.correcoes.itens) || [];
    const corrigidos = { empresa: [], socios: (d.socios || []).map(() => []) };
    corr.forEach(c => { const r = chavesDoCaminho(c.caminho); if (r.socio == null) corrigidos.empresa.push(...r.chaves); else if (corrigidos.socios[r.socio]) corrigidos.socios[r.socio].push(...r.chaves); });
    return { titulo: `${limpa(e.nome || p.empresa || 'Processo')} — ${p.tipo || ''}`, empresa: limpar(empresa), ato: limpar(ato), socios: socios.map(limpar),
      correcoes: corr.length ? { exigencia: d.correcoes.exigencia || '', em: d.correcoes.em || '', itens: corr } : null, corrigidos };
  }

  const UF_NOME = { AC: 'acre', AL: 'alagoas', AP: 'amapa', AM: 'amazonas', BA: 'bahia', CE: 'ceara', DF: 'distrito federal', ES: 'espirito santo', GO: 'goias',
    MA: 'maranhao', MT: 'mato grosso', MS: 'mato grosso do sul', MG: 'minas gerais', PA: 'para', PB: 'paraiba', PR: 'parana', PE: 'pernambuco', PI: 'piaui',
    RJ: 'rio de janeiro', RN: 'rio grande do norte', RS: 'rio grande do sul', RO: 'rondonia', RR: 'roraima', SC: 'santa catarina', SP: 'sao paulo', SE: 'sergipe', TO: 'tocantins' };

  // Caminho dos dados do processo (ex.: "socios.0.endereco") → chaves da ficha que ele preenche
  function chavesDoCaminho(caminho) {
    const p = String(caminho || '').split('.');
    if (p[0] === 'socios') {
      const c = p[2], s = +p[1];
      const mapa = { endereco: ['cep', 'logradouro', 'numero', 'complemento', 'bairro', 'municipio', 'uf'], rg: ['rg', 'rg_orgao', 'rg_uf'], quotas: ['quotas', 'valor_participacao'] };
      return { socio: s, chaves: (mapa[c] || [c]).map(k => 'socio.' + k) };
    }
    if (p[0] === 'alteracao' && p[1] === 'endereco_novo') return { socio: null, chaves: ['empresa.' + p[2]] };
    if (p[0] === 'alteracao' && p[1] === 'nome_novo') return { socio: null, chaves: ['ato.nome_novo'] };
    if (p[0] === 'distrato') return { socio: null, chaves: ['ato.' + p[1]] };
    if (p[0] === 'empresa') {
      const c = p[1];
      if (c === 'nome_ei') return { socio: null, chaves: ['empresa.nome'] };
      if (c === 'objeto') return { socio: null, chaves: ['empresa.objeto', 'empresa.cnae_principal', 'empresa.cnaes_secundarios'] };
      if (c === 'valor_quota') return { socio: null, chaves: ['empresa.valor_quota'] };
      return { socio: null, chaves: ['empresa.' + c] };
    }
    return { socio: null, chaves: [] };
  }
  // A chave foi corrigida (exigência) para este bloco?
  function corrigida(ficha, chave, iSocio = 0) {
    const c = (ficha && ficha.corrigidos) || {};
    return chave.startsWith('socio.') ? ((c.socios || [])[iSocio] || []).includes(chave) : (c.empresa || []).includes(chave);
  }

  // Valor no formato do campo. campo = { tipo, maxlength, opcoes: [{valor, texto}] }
  function ajustarValor(chave, valor, campo) {
    const c = campo || {}, v = String(valor ?? '');
    if (!v) return null;
    if (c.tipo === 'select' || c.tipo === 'radio') {
      const alvo = /(^|\.)(uf|rg_uf)$/.test(chave) && UF_NOME[v.toUpperCase()] ? null : semAcento(v);
      if (alvo === null) {
        const nome = UF_NOME[v.toUpperCase()], ops0 = c.opcoes || [];
        const a = ops0.find(o => semAcento(o.valor) === semAcento(v) || semAcento(limpa(o.texto)) === semAcento(v)) || ops0.find(o => semAcento(limpa(o.texto)) === nome)
          || ops0.find(o => semAcento(limpa(o.texto)).startsWith(semAcento(v) + ' ') || semAcento(limpa(o.texto)).endsWith(' ' + semAcento(v)) || semAcento(limpa(o.texto)).includes('(' + semAcento(v) + ')'));
        return a ? { opcao: a.valor } : null;
      }
      const ops = (c.opcoes || []).filter(o => limpa(o.texto) || limpa(o.valor));
      const norm = o => semAcento(limpa(o.texto));
      const achou = ops.find(o => norm(o) === alvo || semAcento(o.valor) === alvo)
        || ops.find(o => alvo.length >= 2 && (norm(o).startsWith(alvo) || alvo.startsWith(norm(o)) && norm(o).length >= 3))
        || (/uf$/.test(chave) ? ops.find(o => semAcento(o.valor) === alvo.slice(0, 2) || norm(o).startsWith(alvo.slice(0, 2) + ' ')) : null)
        || (/estado_civil|nacionalidade/.test(chave) ? ops.find(o => norm(o).slice(0, 5) === alvo.slice(0, 5)) : null)
        || ops.find(o => norm(o).includes(alvo) && alvo.length >= 4);
      return achou ? { opcao: achou.valor } : null;
    }
    if (c.tipo === 'date') { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v); return { valor: m ? `${m[3]}-${m[2]}-${m[1]}` : v }; }
    const max = +c.maxlength || 0;
    if (/(cpf|cnpj|cep|nire)$/.test(chave)) {
      const dg = digitos(v);
      return { valor: max && max <= dg.length ? dg.slice(0, max) : v };
    }
    if (/(capital|valor_quota|valor_participacao|area)$/.test(chave) && c.tipo === 'number') return { valor: String(+v.replace(/\./g, '').replace(',', '.') || '') };
    if (chave === 'empresa.cnae_principal' && max && max <= 7) return { valor: digitos(v).slice(0, max) };
    return { valor: max && v.length > max ? v.slice(0, max) : v };
  }

  // Valor de uma chave para um bloco: socio.* do sócio escolhido; empresa.* e ato.* da empresa
  function valorDe(ficha, chave, iSocio = 0) {
    if (chave.startsWith('socio.')) return ((ficha.socios || [])[iSocio] || {})[chave];
    return (ficha.empresa || {})[chave] ?? (ficha.ato || {})[chave];
  }

  // Assinatura estável de um campo, para lembrar o que a pessoa ensinou
  const assinatura = (host, d) => `${host}|${d.id || d.nome || semAcento(limpa(d.rotulo)).slice(0, 60)}`;

  const api = { CAMPOS, POR_CHAVE, semAcento, bloco, identificar, partirEndereco, partirRg, cnaes, montarFicha, ajustarValor, valorDe, assinatura, chavesDoCaminho, corrigida };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.JcrMapa = api;
})(typeof self !== 'undefined' ? self : globalThis);
