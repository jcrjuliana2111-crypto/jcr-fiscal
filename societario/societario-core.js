/*
 * Regras do Painel Societário (sem tela e sem banco): modelos de etapas por tipo de ato,
 * documentos a pedir ao cliente, progresso e situação de cada processo.
 *
 * As etapas seguem os manuais do Facilita SP (fluxo rápido, tradicional e baixa) e os
 * Manuais de Registro do DREI (IN 81/2020). Etapa com `fluxo` só entra naquele fluxo;
 * etapa com `naturezas` só entra para aquelas naturezas jurídicas.
 */
(function (root) {
  const PRAZO_EXIGENCIA = 30;   // dias para cumprir exigência ou vício sem nova taxa
  const DIAS_PARADO = 7;        // sem nenhuma etapa marcada há mais que isso = parado

  const TIPOS = {
    abertura: {
      nome: 'Abertura', ic: '🆕', proc: 'abertura',
      docs: [
        'RG e CPF de cada sócio/titular e do administrador',
        'Comprovante de residência atualizado de cada sócio',
        'Certidão de casamento ou de união estável (quando o estado civil influir no registro)',
        'IPTU (ou INCRA) do endereço da empresa',
        'Matrícula, IPTU ou INCRA do imóvel, se o capital for integralizado com imóvel',
        'Atividades que a empresa vai exercer (descrição ou CNAEs)',
        'Valor do capital social e divisão das quotas entre os sócios',
        'Nome empresarial pretendido (2 ou 3 opções) e nome fantasia',
        'Área do imóvel (estabelecimento e terreno)',
        'Conta gov.br nível Ouro de todos os sócios (para assinar)',
      ],
      etapas: [
        ['docs', 'Documentos do cliente recebidos e conferidos'],
        ['govbr', 'Sócios com gov.br nível Ouro'],
        ['risco', 'Simulador de grau de risco (CNAEs) feito'],
        ['viabilidade', 'Nome e viabilidade municipal aprovados'],
        ['dbe', 'DBE no Coletor Nacional liberado', { fluxo: 'tradicional' }],
        ['contrato', 'Contrato social revisado (prévia)'],
        ['assinaturas', 'Todos assinaram pelo gov.br'],
        ['dare', 'DARE paga'],
        ['deferimento', 'Deferido: NIRE e CNPJ emitidos'],
        ['tributacao', 'Forma de tributação escolhida (MAT / Simples Nacional)'],
        ['ie', 'Inscrição estadual (se tiver ICMS)'],
        ['ccm', 'Inscrição municipal (CCM)'],
        ['licencas', 'Licenciamento (CLI / alvará)'],
        ['vicio', 'Análise de vício concluída sem pendência'],
        ['certificado', 'Certificado digital da empresa'],
        ['cadastro', 'Cliente cadastrado no Gestão Fiscal e no JCR Entregas'],
      ],
    },
    alteracao: {
      nome: 'Alteração', ic: '✏️', proc: 'alteracao-contratual',
      docs: [
        'O que vai mudar: nome, endereço, atividade, capital, sócios ou administrador',
        'RG, CPF e comprovante de residência de quem entra (sócio ou administrador)',
        'IPTU (ou INCRA) do novo endereço, se mudar de endereço',
        'Certidão de casamento/divórcio, se o nome civil do sócio mudou',
        'Conta gov.br nível Ouro de quem vai assinar',
      ],
      etapas: [
        ['docs', 'Mudanças definidas e documentos recebidos'],
        ['govbr', 'Signatários com gov.br nível Ouro'],
        ['viabilidade', 'Viabilidade aprovada (se mudar nome, atividade ou endereço)'],
        ['dbe', 'DBE de alteração liberado'],
        ['minuta', 'Alteração contratual revisada (com consolidação)'],
        ['assinaturas', 'Assinaturas concluídas'],
        ['dare', 'DARE paga'],
        ['deferimento', 'Deferido pela JUCESP'],
        ['orgaos', 'SEFAZ e Prefeitura atualizadas (se não vieram pela integração)'],
        ['licencas', 'Licenças/alvará atualizados (se mudou endereço ou atividade)'],
        ['certificado', 'Certificado digital renovado (se mudou o nome empresarial)'],
        ['vicio', 'Análise de vício concluída sem pendência'],
        ['cadastro', 'Cadastro interno atualizado (Gestão Fiscal, Entregas, regime)'],
      ],
    },
    transformacao: {
      nome: 'Transformação', ic: '🔁', proc: 'transformacao',
      docs: [
        'Tipo de transformação: empresário individual → LTDA, LTDA → empresário individual, MEI → ME/EPP',
        'RG, CPF e comprovante de residência dos sócios que entram',
        'Divisão do capital e das quotas na nova sociedade',
        'Conta gov.br nível Ouro de quem vai assinar',
      ],
      etapas: [
        ['docs', 'Tipo definido e documentos recebidos'],
        ['govbr', 'Signatários com gov.br nível Ouro'],
        ['simei', 'Desenquadramento do SIMEI feito', { naturezas: ['MEI'] }],
        ['viabilidade', 'Nome empresarial e viabilidade aprovados no VRE'],
        ['dbe', 'DBE liberado'],
        ['ato', 'Ato de transformação e contrato social revisados'],
        ['assinaturas', 'Assinaturas concluídas'],
        ['dare', 'DARE paga'],
        ['deferimento', 'Deferido pela JUCESP'],
        ['tributacao', 'Tributação revista (Simples, IE, CCM)'],
        ['licencas', 'Licenciamento (CLI / alvará) atualizado com o novo nome'],
        ['certificado', 'Novo certificado digital e-CNPJ (o nome empresarial mudou)'],
        ['vicio', 'Análise de vício concluída sem pendência'],
        ['cadastro', 'Cadastro interno atualizado (natureza jurídica e regime)'],
      ],
    },
    encerramento: {
      nome: 'Encerramento (distrato)', ic: '📕', proc: 'encerramento',
      docs: [
        'Data de encerramento das atividades',
        'Bens a restituir aos sócios (dinheiro, imóveis ou móveis), se houver',
        'Quem fica com a guarda dos livros e documentos',
        'Situação de débitos, parcelamentos e funcionários',
        'Conta gov.br nível Ouro de todos os sócios',
      ],
      etapas: [
        ['docs', 'Dados do encerramento definidos com o cliente'],
        ['pendencias', 'Pendências fiscais, trabalhistas e bancárias verificadas'],
        ['balanco', 'Balanço / posição final de ativo e passivo'],
        ['govbr', 'Sócios com gov.br nível Ouro'],
        ['dbe', 'DBE de extinção (Protocolo REDESIM) liberado'],
        ['distrato', 'Distrato revisado'],
        ['assinaturas', 'Todos assinaram pelo gov.br'],
        ['dare', 'DARE paga'],
        ['deferimento', 'Deferido: certidão de inteiro teor do distrato'],
        ['vicio', 'Análise de vício concluída sem pendência'],
      ],
    },
    baixa: {
      nome: 'Baixa nos órgãos', ic: '🗂️', proc: 'baixa',
      docs: [
        'Certidão de inteiro teor do distrato (ou CNPJ já baixado)',
        'Inscrições estadual e municipal e licenças da empresa',
      ],
      etapas: [
        ['cnpj', 'CNPJ baixado na Receita Federal'],
        ['ie', 'Inscrição estadual baixada (SEFAZ)'],
        ['ccm', 'Inscrição municipal baixada (Prefeitura)'],
        ['licencas', 'Alvarás e licenças cancelados'],
        ['obrigacoes', 'Obrigações de encerramento entregues'],
        ['certificado', 'Certificado digital e procurações revogados'],
        ['cadastro', 'Cliente inativado no Gestão Fiscal, Entregas e honorários'],
      ],
    },
  };

  const STATUS = {
    andamento: 'Em andamento',
    exigencia: 'Em exigência',
    concluido: 'Concluído',
    cancelado: 'Cancelado',
  };

  // Processo em papel (protocolo presencial na JUCESP): troca a assinatura gov.br por impressão/assinatura física
  // e acrescenta protocolo no balcão e retirada dos documentos (descartados após 90 dias)
  const PRAZO_RETIRADA = 90;
  Object.values(TIPOS).forEach(t => {
    const ids = t.etapas.map(e => e[0]);
    if (!ids.includes('dare') || !ids.includes('deferimento')) return;
    const ass = t.etapas.find(e => e[0] === 'assinaturas');
    if (ass) ass[2] = { ...(ass[2] || {}), entrada: 'digital' };
    t.etapas.splice(ids.indexOf('dare'), 0, ['impressao', 'Documentos impressos e assinados por todos (firma reconhecida, se exigida)', { entrada: 'papel' }]);
    const iDare = t.etapas.findIndex(e => e[0] === 'dare');
    t.etapas.splice(iDare + 1, 0, ['protocolo', 'Protocolado na JUCESP (balcão ou agendamento)', { entrada: 'papel' }]);
    const iDef = t.etapas.findIndex(e => e[0] === 'deferimento');
    t.etapas.splice(iDef + 1, 0, ['retirada', `Documentos retirados na JUCESP (até ${PRAZO_RETIRADA} dias)`, { entrada: 'papel' }]);
  });

  // Taxa da JUCESP (DARE) de 2026 — Portaria JUCESP nº 146/2025, UFESP R$ 38,42. Só os atos com valor conferido.
  const TAXAS_JUCESP = {
    fonte: 'Tabela JUCESP 2026 (Portaria nº 146/2025)',
    ltda: { normal: 273.55, me_epp: 218.99 },
    ei: { normal: 120.25, me_epp: 94.90 },
  };
  function taxaJucesp(p) {
    if (!p || !['abertura', 'transformacao'].includes(p.tipo)) return null;
    const porte = ((p.dados && p.dados.empresa) || {}).enquadramento;
    const me = /^(ME|EPP)$/i.test(porte || '');
    const ei = p.tipo === 'abertura' && /^(EI|MEI)$/.test(p.natureza || '');
    const t = ei ? TAXAS_JUCESP.ei : TAXAS_JUCESP.ltda;
    const valor = me ? t.me_epp : t.normal;
    return { valor, texto: `${ei ? 'Empresário individual' : 'Contrato social de LTDA'} ${me ? porte.toUpperCase() : 'porte normal'}`, fonte: TAXAS_JUCESP.fonte };
  }

  function addDias(iso, n) {
    const d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }
  const diasEntre = (de, ate) => Math.round((new Date(ate + 'T12:00:00') - new Date(de + 'T12:00:00')) / 86400000);

  // Etapas iniciais de um processo novo, já filtradas pelo fluxo e pela natureza
  function etapasPadrao(tipo, fluxo, natureza, entrada = 'digital') {
    const t = TIPOS[tipo];
    if (!t) return [];
    return t.etapas
      .filter(([, , o = {}]) => (!o.fluxo || o.fluxo === fluxo) && (!o.naturezas || o.naturezas.includes(natureza)) && (!o.entrada || o.entrada === (entrada || 'digital')))
      .map(([id, nome]) => ({ id, nome, feito: false, data: null }));
  }

  // Ao trocar a forma de entrada de um processo existente: entram as etapas que faltam (desmarcadas),
  // saem só as que não valem mais e ainda não foram marcadas. Nada marcado é perdido.
  function ajustarEtapas(p, entrada) {
    const modelo = etapasPadrao(p.tipo, p.fluxo, p.natureza, entrada);
    const atuais = p.etapas || [];
    const porId = Object.fromEntries(atuais.map(e => [e.id, e]));
    const noModelo = new Set(modelo.map(e => e.id));
    return [...modelo.map(e => porId[e.id] || e), ...atuais.filter(e => !noModelo.has(e.id) && (e.feito || !TIPOS[p.tipo] || !TIPOS[p.tipo].etapas.some(x => x[0] === e.id)))];
  }

  // Processos em papel deferidos e ainda não retirados: dias que restam até o descarte
  function retiradaPendente(p, hoje) {
    if (p.entrada !== 'papel' || p.status === 'cancelado') return null;
    const et = p.etapas || [], def = et.find(e => e.id === 'deferimento'), ret = et.find(e => e.id === 'retirada');
    if (!def || !def.feito || !ret || ret.feito) return null;
    const desde = def.data || hoje;
    return { desde, restam: PRAZO_RETIRADA - diasEntre(desde, hoje) };
  }

  function progresso(p) {
    const etapas = p.etapas || [];
    const feitas = etapas.filter(e => e.feito).length;
    const proxima = etapas.find(e => !e.feito);
    return { feitas, total: etapas.length, pct: etapas.length ? Math.round(feitas / etapas.length * 100) : 0, proxima: proxima ? proxima.nome : null };
  }

  const prazoExigencia = p => (p.exigencia_em ? addDias(p.exigencia_em, PRAZO_EXIGENCIA) : null);

  // Última movimentação: etapa marcada mais recente, ou o início do processo
  function ultimoMovimento(p) {
    return (p.etapas || []).reduce((m, e) => (e.feito && e.data && e.data > m ? e.data : m), p.iniciado_em);
  }

  // Situação para o painel: concluido | cancelado | exigencia_vencida | exigencia | parado | andamento
  function situacao(p, hoje) {
    if (p.status === 'concluido' || p.status === 'cancelado') return p.status;
    if (p.status === 'exigencia') {
      const prazo = prazoExigencia(p);
      return prazo && prazo < hoje ? 'exigencia_vencida' : 'exigencia';
    }
    return diasEntre(ultimoMovimento(p), hoje) > DIAS_PARADO ? 'parado' : 'andamento';
  }

  // Marca ou desmarca uma etapa (devolve novas etapas, sem mudar as originais)
  function marcarEtapa(etapas, id, feito, hoje) {
    return etapas.map(e => (e.id === id ? { ...e, feito, data: feito ? hoje : null } : e));
  }

  // Texto para mandar ao cliente pedindo os documentos
  function textoDocumentos(tipo, empresa) {
    const t = TIPOS[tipo];
    if (!t) return '';
    return `Olá! Para darmos andamento à ${t.nome.toLowerCase()}${empresa ? ' de ' + empresa : ''}, precisamos de:\n\n` +
      t.docs.map(d => '• ' + d).join('\n') +
      '\n\nPode enviar por aqui mesmo. Qualquer dúvida, estamos à disposição.';
  }

  // Holding: abertura (ou alteração) de holding segue o procedimento próprio, não o da abertura comum
  function ehHolding(p) {
    const e = (p && p.dados && p.dados.empresa) || {};
    const cnaes = [].concat(e.objeto || []).join(' ').replace(/\D+/g, ' ');
    return /holding/i.test(`${p && p.empresa} ${e.nome || ''}`) || /\b(64620|64638)/.test(cnaes.replace(/ /g, ''));
  }
  function procedimentoDe(p) {
    if (!p || !TIPOS[p.tipo]) return null;
    return (p.tipo === 'abertura' || p.tipo === 'alteracao') && ehHolding(p) ? 'holding' : TIPOS[p.tipo].proc;
  }

  const api = { TIPOS, STATUS, PRAZO_EXIGENCIA, DIAS_PARADO, addDias, diasEntre, etapasPadrao, progresso,
    prazoExigencia, ultimoMovimento, situacao, marcarEtapa, textoDocumentos, ehHolding, procedimentoDe, ajustarEtapas, retiradaPendente, PRAZO_RETIRADA, TAXAS_JUCESP, taxaJucesp };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Societario = api;
})(typeof window !== 'undefined' ? window : globalThis);
