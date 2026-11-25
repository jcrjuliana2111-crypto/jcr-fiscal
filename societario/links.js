/*
 * Links oficiais usados no Painel Societário e nos procedimentos.
 * Para incluir uma prefeitura: acrescente em MUNICIPIOS (chave = nome sem acento, minúsculo)
 * com as mesmas chaves de LINKS que ela substitui ou complementa.
 *
 * modo: 'online' | 'presencial' | 'info'. "conferir" = link de fonte antiga, confirmar no primeiro uso.
 */
(function (root) {
  const LINKS = {
    facilita: { nome: 'Facilita SP (abertura, alteração e baixa)', url: 'https://portalfacilitasp.sp.gov.br/facilitasp', modo: 'online' },
    facilita_assinaturas: { nome: 'Facilita SP — Minhas assinaturas (gov.br Ouro)', url: 'https://portalfacilitasp.sp.gov.br/facilitasp', modo: 'online' },
    vre: { nome: 'VRE — Via Rápida Empresa (cadastro do processo, documentos da JUCESP, exigências e licenciamento)', url: 'https://www.vreredesim.sp.gov.br/', modo: 'online' },
    redesim: { nome: 'REDESIM — Coletor Nacional (DBE)', url: 'https://www.gov.br/empresas-e-negocios/pt-br/redesim', modo: 'online' },
    jucesponline: { nome: 'JucespOnline — nome empresarial, ficha cadastral, certidões e andamento', url: 'https://www.jucesponline.sp.gov.br/', modo: 'online' },
    jucesp_precos: { nome: 'JUCESP — serviços e tabela de preços (a DARE sai pronta no sistema do ato)', url: 'https://www.institucional.jucesp.sp.gov.br/empresas.html', modo: 'info' },
    jucesp_agendamento: { nome: 'JUCESP — agendamento de atendimento presencial', url: 'http://atendimento.jucesp.sp.gov.br/agendamento/', modo: 'presencial', conferir: true },
    jucesp_agendamento_online: { nome: 'JucespOnline — "Agendamento de Atendimento Presencial" (Outras solicitações)', url: 'https://www.jucesponline.sp.gov.br/', modo: 'presencial' },
    govbr_niveis: { nome: 'gov.br — como subir a conta para nível Ouro', url: 'https://www.gov.br/governodigital/pt-br/identidade/conta-gov-br/niveis-da-conta-govbr/saiba-mais-sobre-os-niveis-da-conta-govbr', modo: 'info' },
    cartao_cnpj: { nome: 'Receita Federal — cartão CNPJ', url: 'https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_Solicitacao.asp', modo: 'online' },
    simples: { nome: 'Portal do Simples Nacional (opção e desenquadramento do SIMEI)', url: 'https://www8.receita.fazenda.gov.br/SimplesNacional/', modo: 'online' },
    cadesp: { nome: 'SEFAZ-SP — CADESP (inscrição estadual)', url: 'https://www.cadesp.fazenda.sp.gov.br/', modo: 'online' },
    modelos: { nome: 'Portal — preencher dados e gerar o documento (Word)', url: 'societario/modelos.html', modo: 'online', interno: true },
    conferidor: { nome: 'Portal — conferir os PDFs antes de assinar', url: 'societario/conferidor.html', modo: 'online', interno: true },
    certificados: { nome: 'Portal — Certificados, alvarás e licenças (cofre e vencimentos)', url: 'societario/vencimentos.html', modo: 'online', interno: true },
    gestao: { nome: 'Portal — Gestão Fiscal (cadastro, regime e honorários)', url: 'gclik.html', modo: 'online', interno: true },
    entregas: { nome: 'Portal — JCR Entregas (obrigações do cliente)', url: 'entregas/', modo: 'online', interno: true },
    ecac: { nome: 'e-CAC — situação fiscal, pendências e procurações', url: 'https://cav.receita.fazenda.gov.br/autenticacao/login', modo: 'online' },
    regularize: { nome: 'PGFN Regularize — dívida ativa da União', url: 'https://www.regularize.pgfn.gov.br/', modo: 'online' },
    cnd_federal: { nome: 'Receita Federal — certidão negativa de débitos federais', url: 'https://servicos.receitafederal.gov.br/servico/certidoes/#/home', modo: 'online', conferir: true },
    cnd_estadual: { nome: 'PGE-SP — certidão de débitos inscritos na dívida ativa do Estado', url: 'https://www.dividaativa.pge.sp.gov.br/sc/pages/crda/emitirCrda.jsf', modo: 'online', conferir: true },
    crf_fgts: { nome: 'Caixa — certificado de regularidade do FGTS (CRF)', url: 'https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf', modo: 'online' },
    cndt: { nome: 'TST — certidão negativa de débitos trabalhistas (CNDT)', url: 'https://cndt-certidao.tst.jus.br/inicio.faces', modo: 'online' },
    preenchedor: { nome: 'JCR Preenchedor — preencher o VRE/Facilita SP com os dados do portal (ícone da extensão no Chrome)', url: 'societario/extensao.html', modo: 'online', interno: true },
  };

  const MUNICIPIOS = {
    campinas: {
      nome: 'Campinas',
      links: {
        viabilidade_municipal: { nome: 'Campinas — Zoneamento On-line (viabilidade por endereço e CNAE)', url: 'https://zoneamento.campinas.sp.gov.br/', modo: 'online' },
        viabilidade_servico: { nome: 'Campinas — Consulta CNAE / Zoneamento / Viabilidade (orientações)', url: 'https://portal-adm.campinas.sp.gov.br/servico/consulta-cnae-zoneamento-viabilidade', modo: 'info' },
        alvara: { nome: 'Campinas — Solicitar alvará de uso', url: 'https://portal-adm.campinas.sp.gov.br/servico/solicitar-alvara-de-uso', modo: 'online' },
        inscricao_municipal: { nome: 'Campinas — Consultar inscrição municipal de ISSQN', url: 'https://portal-adm.campinas.sp.gov.br/servico/consultar-inscricao-municipal-de-issqn', modo: 'online' },
        situacao_mobiliaria: { nome: 'Campinas — Comprovante de situação cadastral mobiliária', url: 'https://situacao.campinas.sp.gov.br/', modo: 'online', conferir: true },
        iss: { nome: 'Campinas — ISS Digital (nota fiscal e ISS)', url: 'https://issdigital.campinas.sp.gov.br/issdigital/login.jsp?codcid=6291', modo: 'online' },
      },
    },
    sumare: {
      nome: 'Sumaré',
      links: {
        viabilidade_municipal: { nome: 'Sumaré — viabilidade pelo Via Rápida Empresa / Facilita SP (confirmar se o município responde pelo sistema; senão, pedir na prefeitura)', url: 'https://www.vreredesim.sp.gov.br/', modo: 'online', conferir: true },
        viabilidade_servico: { nome: 'Sumaré — Plano Diretor e mapas de zoneamento (uso do solo)', url: 'https://www.sumare.sp.gov.br/plano_diretor/', modo: 'info', conferir: true },
        inscricao_municipal: { nome: 'Sumaré — Portal do Cidadão: ISS / NF Eletrônica (cadastro mobiliário, certidões)', url: 'https://www.sumare.sp.gov.br/cidadao/pagina/iss-nf-eletronica', modo: 'online' },
        alvara: { nome: 'Sumaré — Portal do Cidadão (alvará e serviços para empresas)', url: 'https://www.sumare.sp.gov.br/cidadao/', modo: 'online', conferir: true },
        iss: { nome: 'Sumaré — SIGISS (nota fiscal de serviço e ISS)', url: 'https://sumare.sigissweb.com/', modo: 'online', conferir: true },
        situacao_mobiliaria: { nome: 'Sumaré — validar NFS-e emitida', url: 'https://sumare.sigissweb.com/validarnfe', modo: 'online', conferir: true },
      },
    },
  };

  // Links de cada etapa do Painel Societário (por id da etapa)
  const ETAPAS = {
    docs: ['modelos'],
    govbr: ['govbr_niveis'],
    risco: ['facilita', 'vre'],
    viabilidade: ['viabilidade_municipal', 'viabilidade_servico', 'vre', 'facilita', 'jucesponline'],
    dbe: ['redesim', 'vre', 'preenchedor'],
    contrato: ['modelos', 'vre', 'preenchedor', 'conferidor'], minuta: ['modelos', 'vre', 'preenchedor', 'conferidor'],
    ato: ['modelos', 'vre', 'preenchedor', 'conferidor'], distrato: ['modelos', 'vre', 'preenchedor', 'conferidor'],
    assinaturas: ['facilita_assinaturas', 'vre', 'conferidor'],
    dare: ['vre', 'jucesp_precos'],
    deferimento: ['vre', 'jucesponline', 'jucesp_agendamento_online', 'cartao_cnpj'],
    vicio: ['vre', 'jucesponline', 'jucesp_agendamento_online', 'jucesp_agendamento'],
    tributacao: ['simples', 'cartao_cnpj', 'cadesp', 'inscricao_municipal'], simei: ['simples'], cnpj: ['cartao_cnpj'],
    ie: ['cadesp'], ccm: ['inscricao_municipal', 'iss', 'situacao_mobiliaria', 'vre'], orgaos: ['cadesp', 'inscricao_municipal'],
    licencas: ['alvara', 'vre'],
    obrigacoes: ['simples'],
    certificado: ['certificados', 'ecac'],
    cadastro: ['gestao', 'entregas'],
    pendencias: ['ecac', 'regularize', 'cnd_federal', 'cnd_estadual', 'crf_fgts', 'cndt'],
  };

  const chave = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, '');

  function municipio(nome) { return MUNICIPIOS[chave(nome)] || null; }

  // Resolve uma lista de chaves para links, com os da prefeitura do processo na frente
  function resolver(chaves, nomeMunicipio) {
    const m = municipio(nomeMunicipio);
    return chaves.map(k => (m && m.links[k]) || LINKS[k]).filter(Boolean);
  }

  const daEtapa = (idEtapa, nomeMunicipio) => resolver(ETAPAS[idEtapa] || [], nomeMunicipio);

  const api = { LINKS, MUNICIPIOS, ETAPAS, municipio, resolver, daEtapa };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LinksSoc = api;
})(typeof window !== 'undefined' ? window : globalThis);
