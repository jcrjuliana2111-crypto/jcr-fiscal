/*
 * Licenças, registros e autorizações exigidos pela ATIVIDADE da empresa (além da Junta, CNPJ e inscrições).
 * Usado no procedimento (lista completa e busca), no "Dados e documentos" (alerta pelo objeto preenchido)
 * e testado em tests/licencas.test.js.
 *
 * Cada regra: { id, titulo, cnae: [prefixos sem pontuação], palavras: RegExp, orgao, exige, base, quando, link?, nivel }
 *   cnae: prefixo do código (ex.: '6920' pega 6920-6/01 e 6920-6/02; '86' pega a divisão inteira)
 *   nivel: 'bloqueia' (muda onde registrar), 'obrigatorio', 'verificar' (depende do porte/produto/local)
 *
 * Para incluir uma atividade: acrescente uma regra. Confira sempre a norma do órgão antes do protocolo:
 * o texto aqui é um alerta para não esquecer, não substitui a consulta.
 */
(function (root) {
  const SAUDE_VISA = 'Licença sanitária da Vigilância Sanitária (municipal ou estadual, conforme o risco) e cadastro no CNES';
  const L6839 = 'Lei 6.839/1980, art. 1º (registro da empresa no conselho da atividade básica)';

  const REGRAS = [
    // ── profissões regulamentadas ──
    { id: 'contabil', titulo: 'Serviços contábeis', cnae: ['6920'], palavras: /contab|auditoria cont|per[ií]cia cont/,
      orgao: 'CRC-SP', exige: 'Registro cadastral da organização contábil no CRC-SP, com contador responsável técnico. Sócios contadores com registro ativo.',
      base: 'Decreto-Lei 9.295/1946 e resolução do CFC sobre registro cadastral', quando: 'Logo após o registro na Junta e antes de prestar serviço (o CRC pede o contrato registrado).', link: 'https://crcsp.org.br/', nivel: 'obrigatorio' },
    { id: 'representacao', titulo: 'Representação comercial', cnae: ['461'], palavras: /representa[cç][aã]o comercial|representante comercial|agente do com[eé]rcio/,
      orgao: 'CORE-SP', exige: 'Registro da pessoa jurídica no Conselho Regional dos Representantes Comerciais, com responsável técnico representante registrado.',
      base: 'Lei 4.886/1965, art. 2º', quando: 'Antes de começar a representar (sem registro o contrato de representação fica irregular).', link: 'https://www.core-sp.org.br/', nivel: 'obrigatorio' },
    { id: 'advocacia', titulo: 'Advocacia', cnae: ['6911701'], palavras: /advocac|servi[cç]os advocat/,
      orgao: 'OAB-SP', exige: 'Sociedade de advogados (ou sociedade unipessoal de advocacia) é registrada na OAB, NÃO na Junta Comercial.',
      base: 'Lei 8.906/1994 (Estatuto da Advocacia), arts. 15 e 16', quando: 'O ato constitutivo vai direto para a OAB-SP; depois CNPJ e inscrição municipal.', link: 'https://www.oabsp.org.br/', nivel: 'bloqueia' },
    { id: 'engenharia', titulo: 'Engenharia, agronomia e geociências', cnae: ['7112', '7119', '7120', '4120', '421', '422', '429', '4311', '4312', '4313', '4319', '4321', '4322', '4329', '4391', '4399'], palavras: /engenharia|instala[cç][aã]o el[eé]trica|agron[oô]m|topograf/,
      orgao: 'CREA-SP', exige: 'Registro da empresa no CREA-SP e responsável técnico com ART; o objeto não pode ter atividade sem profissional habilitado.',
      base: 'Lei 5.194/1966, arts. 59 e 60', quando: 'Antes de executar obra ou serviço técnico. Algumas atividades do grupo 43 só exigem quando há responsabilidade técnica: confira.', link: 'https://www.creasp.org.br/', nivel: 'obrigatorio' },
    { id: 'arquitetura', titulo: 'Arquitetura e urbanismo', cnae: ['7111'], palavras: /arquitet|urbanis/,
      orgao: 'CAU/SP', exige: 'Registro da pessoa jurídica no CAU/SP com arquiteto responsável técnico.',
      base: 'Lei 12.378/2010, art. 11', quando: 'Antes de prestar serviço de arquitetura.', link: 'https://www.causp.gov.br/', nivel: 'obrigatorio' },
    { id: 'administracao', titulo: 'Consultoria em gestão / administração', cnae: ['7020'], palavras: /consultoria em gest[aã]o|administra[cç][aã]o de empresas/,
      orgao: 'CRA-SP', exige: 'O CRA-SP costuma exigir registro quando a atividade básica é de administração (consultoria em gestão, RH, organização). Avalie o objeto: há decisões judiciais afastando a exigência.',
      base: 'Lei 4.769/1965 e ' + L6839, quando: 'Avaliar na abertura; se registrar, indicar administrador responsável.', link: 'https://www.crasp.gov.br/', nivel: 'verificar' },
    { id: 'economia', titulo: 'Economia', cnae: [], palavras: /consultoria econ[oô]mica|servi[cç]os de economia|economista/,
      orgao: 'CORECON-SP', exige: 'Registro no Conselho Regional de Economia quando a atividade básica for de economista.',
      base: 'Lei 1.411/1951 e ' + L6839, quando: 'Antes de prestar o serviço.', link: 'https://www.coreconsp.gov.br/', nivel: 'verificar' },
    { id: 'quimica', titulo: 'Indústria e serviços químicos', cnae: ['20', '2110', '2121', '2122', '2123'], palavras: /qu[ií]mic/,
      orgao: 'CRQ-IV (SP)', exige: 'Registro no Conselho Regional de Química e químico responsável quando houver processo químico na atividade básica.',
      base: 'Lei 2.800/1956, art. 27, e ' + L6839, quando: 'Antes de operar.', link: 'https://www.crq4.org.br/', nivel: 'verificar' },

    // ── saúde ──
    { id: 'medicina', titulo: 'Atividade médica', cnae: ['8610', '8621', '8622', '8630501', '8630502', '8630503', '8640'], palavras: /m[eé]dic|hemoterap|diagn[oó]stico por imagem|hospital/,
      orgao: 'CRM-SP', exige: 'Registro da pessoa jurídica no CRM-SP com diretor técnico médico.',
      base: L6839 + ' e resoluções do CFM sobre registro de empresas', quando: 'Antes de atender pacientes.', link: 'https://www.cremesp.org.br/', nivel: 'obrigatorio' },
    { id: 'hemoterapia', titulo: 'Hemoterapia', cnae: ['8640212'], palavras: /hemoterap/,
      orgao: 'Vigilância Sanitária / ANVISA', exige: 'Serviço de hemoterapia segue as boas práticas do ciclo do sangue; licença sanitária específica e responsável técnico médico hemoterapeuta.',
      base: 'Lei 10.205/2001 e RDC ANVISA 34/2014', quando: 'Antes de iniciar; confira se a atividade será exercida em estabelecimento próprio ou dentro de hospital.', link: 'https://www.gov.br/anvisa/', nivel: 'obrigatorio' },
    { id: 'odontologia', titulo: 'Odontologia', cnae: ['8630504'], palavras: /odontol|dentist/,
      orgao: 'CRO-SP', exige: 'Registro da pessoa jurídica no CRO-SP com responsável técnico cirurgião-dentista.',
      base: L6839, quando: 'Antes de atender pacientes.', link: 'https://www.crosp.org.br/', nivel: 'obrigatorio' },
    { id: 'enfermagem', titulo: 'Enfermagem', cnae: ['8650001', '8712'], palavras: /enfermag/,
      orgao: 'COREN-SP', exige: 'Registro no COREN-SP com enfermeiro responsável técnico.', base: L6839, quando: 'Antes de iniciar.', link: 'https://portal.coren-sp.gov.br/', nivel: 'obrigatorio' },
    { id: 'nutricao', titulo: 'Nutrição', cnae: ['8650002'], palavras: /nutri[cç][aã]o|nutricionist/,
      orgao: 'CRN-3', exige: 'Registro no CRN-3 com nutricionista responsável técnico.', base: L6839, quando: 'Antes de iniciar.', link: 'https://www.crn3.org.br/', nivel: 'obrigatorio' },
    { id: 'psicologia', titulo: 'Psicologia', cnae: ['8650003'], palavras: /psicolog/,
      orgao: 'CRP-06', exige: 'Cadastro da pessoa jurídica no CRP-06 com psicólogo responsável técnico.', base: L6839, quando: 'Antes de iniciar.', link: 'https://www.crpsp.org.br/', nivel: 'obrigatorio' },
    { id: 'fisioterapia', titulo: 'Fisioterapia e terapia ocupacional', cnae: ['8650004', '8650005'], palavras: /fisioterap|terapia ocupacional/,
      orgao: 'CREFITO-3', exige: 'Registro no CREFITO-3 com responsável técnico.', base: L6839, quando: 'Antes de iniciar.', link: 'https://www.crefito3.org.br/', nivel: 'obrigatorio' },
    { id: 'fonoaudiologia', titulo: 'Fonoaudiologia', cnae: ['8650006'], palavras: /fonoaudiol/,
      orgao: 'CRFa-2', exige: 'Registro no Conselho Regional de Fonoaudiologia com responsável técnico.', base: L6839, quando: 'Antes de iniciar.', link: 'https://www.fonosp.org.br/', nivel: 'obrigatorio' },
    { id: 'saude_visa', titulo: 'Estabelecimento de saúde (licença sanitária)', cnae: ['86', '8711', '8712', '8720', '8730'], palavras: /cl[ií]nica m[eé]dica|laborat[oó]rio cl[ií]nico|consult[oó]rio m[eé]dico|consult[oó]rio odontol/,
      orgao: 'Vigilância Sanitária', exige: SAUDE_VISA + '. Radiologia/imagem tem exigências próprias de proteção radiológica.',
      base: 'Código Sanitário de SP (Lei estadual 10.083/1998) e normas da ANVISA', quando: 'Antes de abrir ao público; o grau de risco aparece no simulador do Facilita SP.', nivel: 'obrigatorio' },
    { id: 'laboratorio', titulo: 'Laboratório clínico', cnae: ['8640202'], palavras: /laborat[oó]rio cl[ií]nico|an[aá]lises cl[ií]nicas/,
      orgao: 'Conselho do responsável técnico (CRF, CRBM ou CRM) + Vigilância Sanitária', exige: 'Responsável técnico registrado no conselho dele e licença sanitária.',
      base: 'Normas da ANVISA para serviços de análises clínicas e ' + L6839, quando: 'Antes de iniciar.', nivel: 'obrigatorio' },
    { id: 'farmacia', titulo: 'Farmácia, drogaria e medicamentos', cnae: ['4771', '4644', '2121', '2123'], palavras: /farm[aá]cia|drogaria|medicament/,
      orgao: 'CRF-SP, ANVISA e Vigilância Sanitária', exige: 'Farmacêutico responsável técnico (CRF-SP), Autorização de Funcionamento (AFE) da ANVISA e licença sanitária.',
      base: 'Lei 13.021/2014, Lei 6.360/1976 e Lei 5.991/1973', quando: 'Antes de comprar o primeiro estoque.', link: 'https://www.crfsp.org.br/', nivel: 'obrigatorio' },
    { id: 'veterinaria', titulo: 'Veterinária', cnae: ['7500'], palavras: /veterin/,
      orgao: 'CRMV-SP', exige: 'Registro no CRMV-SP com médico-veterinário responsável técnico (pet shop que vende medicamento veterinário também).',
      base: 'Lei 5.517/1968, art. 27', quando: 'Antes de iniciar.', link: 'https://www.crmvsp.gov.br/', nivel: 'obrigatorio' },
    { id: 'educacao_fisica', titulo: 'Academias e atividades físicas', cnae: ['9313'], palavras: /academia|condicionamento f[ií]sico|educa[cç][aã]o f[ií]sica|personal/,
      orgao: 'CREF4/SP', exige: 'Registro da pessoa jurídica no CREF4/SP com profissional de educação física responsável.',
      base: 'Lei 9.696/1998', quando: 'Antes de abrir.', link: 'https://www.crefsp.gov.br/', nivel: 'obrigatorio' },
    { id: 'beleza', titulo: 'Estética e beleza', cnae: ['9602'], palavras: /est[eé]tica|cabeleireir|manicure|beleza/,
      orgao: 'Vigilância Sanitária', exige: 'Licença ou cadastro sanitário conforme o risco (procedimentos invasivos e estética com equipamentos têm risco maior).',
      base: 'Código Sanitário de SP (Lei estadual 10.083/1998)', quando: 'Antes de abrir ao público.', nivel: 'verificar' },

    // ── imóveis, seguros e finanças ──
    { id: 'imobiliaria', titulo: 'Corretagem e administração de imóveis de terceiros', cnae: ['6821', '6822'], palavras: /corretagem|imobili[aá]ria|administra[cç][aã]o de im[oó]veis de terceiros/,
      orgao: 'CRECI-SP', exige: 'Registro da pessoa jurídica no CRECI-SP com corretor responsável técnico.',
      base: 'Lei 6.530/1978, art. 6º', quando: 'Antes de intermediar. Atenção na holding: compra, venda e aluguel de imóveis PRÓPRIOS (6810-2) não exige CRECI.', link: 'https://www.crecisp.gov.br/', nivel: 'obrigatorio' },
    { id: 'seguros', titulo: 'Corretagem de seguros', cnae: ['6622'], palavras: /corretag\w* de seguro|corretora de seguro/,
      orgao: 'SUSEP', exige: 'Registro de corretor de seguros pessoa jurídica na SUSEP, com responsável técnico corretor habilitado.',
      base: 'Lei 4.594/1964 e normas da SUSEP', quando: 'Antes de intermediar seguros.', link: 'https://www.gov.br/susep/', nivel: 'obrigatorio' },
    { id: 'financeiro', titulo: 'Atividades financeiras e de crédito', cnae: ['641', '642', '643', '644', '645', '646403', '649', '6612', '6613'], palavras: /institui[cç][aã]o financeira|institui[cç][aã]o de pagamento|c[aâ]mbio|administra[cç][aã]o de cons[oó]rcio/,
      orgao: 'Banco Central / CVM', exige: 'Instituições financeiras, de pagamento, câmbio e consórcio dependem de autorização do Banco Central; gestão de recursos e valores mobiliários, da CVM.',
      base: 'Lei 4.595/1964, Lei 12.865/2013 e Lei 6.385/1976', quando: 'Antes de operar. Correspondente bancário e Empresa Simples de Crédito (LC 167/2019) têm regras próprias: confira.', nivel: 'verificar' },

    // ── transporte, turismo e segurança ──
    { id: 'transporte_cargas', titulo: 'Transporte rodoviário de cargas', cnae: ['4930'], palavras: /transporte rodovi[aá]rio de carga/,
      orgao: 'ANTT (RNTRC)', exige: 'Inscrição no Registro Nacional de Transportadores Rodoviários de Cargas (RNTRC), com responsável técnico e veículos cadastrados.',
      base: 'Lei 11.442/2007', quando: 'Antes de transportar carga de terceiros por remuneração.', link: 'https://www.gov.br/antt/', nivel: 'obrigatorio' },
    { id: 'transporte_passageiros', titulo: 'Transporte de passageiros (fretamento)', cnae: ['4922', '4923', '4924', '4929'], palavras: /fretamento|transporte de passageiros|transporte escolar/,
      orgao: 'ARTESP (intermunicipal SP), ANTT (interestadual) ou prefeitura (municipal/escolar)', exige: 'Autorização ou cadastro do órgão que regula a linha ou o fretamento, e vistoria dos veículos.',
      base: 'Normas da ARTESP e da ANTT', quando: 'Antes de operar.', nivel: 'verificar' },
    { id: 'turismo', titulo: 'Agência de viagens e turismo', cnae: ['7911', '7912', '7990', '5510', '5590'], palavras: /ag[eê]ncia de viage|turism|hospedagem|hotel|pousada/,
      orgao: 'Ministério do Turismo (CADASTUR)', exige: 'Cadastro obrigatório no CADASTUR para agências, meios de hospedagem e organizadoras de eventos turísticos.',
      base: 'Lei 11.771/2008, art. 22', quando: 'Antes de operar; renovar a cada 2 anos.', link: 'https://cadastur.turismo.gov.br/', nivel: 'obrigatorio' },
    { id: 'seguranca', titulo: 'Vigilância e segurança privada', cnae: ['8011', '8012'], palavras: /vigil[aâ]ncia|seguran[cç]a privada|transporte de valores/,
      orgao: 'Polícia Federal', exige: 'Autorização de funcionamento da Polícia Federal (capital mínimo, sócios e instalações conforme a norma).',
      base: 'Estatuto da Segurança Privada (Lei 14.967/2024)', quando: 'Antes de operar; a JUCESP pode exigir a autorização prévia.', nivel: 'obrigatorio' },

    // ── comércio e indústria com controle ──
    { id: 'combustivel', titulo: 'Combustíveis e GLP', cnae: ['4731', '4732', '4784', '4681'], palavras: /combust[ií]vel|posto de gasolina|glp|g[aá]s liquefeito/,
      orgao: 'ANP, CETESB e Corpo de Bombeiros', exige: 'Autorização da ANP para revenda/distribuição, licença ambiental da CETESB e AVCB.',
      base: 'Lei 9.478/1997 e resoluções da ANP', quando: 'Antes de operar.', link: 'https://www.gov.br/anp/', nivel: 'obrigatorio' },
    { id: 'controlados', titulo: 'Produtos químicos controlados', cnae: ['4684', '2011', '2012', '2013', '2014', '2019', '2029'], palavras: /produtos qu[ií]micos|insumos qu[ií]micos/,
      orgao: 'Polícia Federal (e Exército, conforme o produto)', exige: 'Licença/Certificado da Polícia Federal para produtos químicos controlados; produtos controlados pelo Exército (PCE) exigem registro no Exército.',
      base: 'Lei 10.357/2001 e regulamento de produtos controlados do Exército', quando: 'Antes de comprar, vender ou usar o produto controlado.', nivel: 'verificar' },
    { id: 'armas', titulo: 'Armas, munições e explosivos', cnae: ['4789009', '2550', '2092'], palavras: /armas|muni[cç][aã]o|explosiv/,
      orgao: 'Exército (SFPC) e Polícia Federal', exige: 'Registro e autorização do Exército para fabricar, comerciar ou armazenar produtos controlados.',
      base: 'Regulamento de Produtos Controlados do Exército', quando: 'Antes de operar.', nivel: 'obrigatorio' },
    { id: 'alimentos', titulo: 'Alimentos e bebidas', cnae: ['10', '11', '4721', '4722', '4723', '4724', '4729', '5611', '5612', '5620', '4631', '4632', '4633', '4634', '4635', '4637', '4639'], palavras: /aliment|restaurante|lanchonete|bebida|padaria|a[cç]ougue/,
      orgao: 'Vigilância Sanitária (e MAPA para produtos de origem animal e bebidas)', exige: 'Licença ou cadastro sanitário conforme o risco; indústria de produto de origem animal ou de bebidas precisa de registro no Ministério da Agricultura (SIF/SIE/SIM).',
      base: 'Código Sanitário de SP (Lei estadual 10.083/1998) e normas do MAPA', quando: 'Antes de abrir.', nivel: 'verificar' },
    { id: 'ambiental', titulo: 'Licença ambiental (CETESB)', cnae: ['05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '35', '36', '37', '38', '39'], palavras: /ind[uú]stria|fabrica[cç][aã]o|res[ií]duo|reciclag/,
      orgao: 'CETESB', exige: 'Licenças Prévia, de Instalação e de Operação para atividades potencialmente poluidoras (indústria, resíduos, extração). Muitas atividades de baixo impacto são dispensadas: confira a lista.',
      base: 'Lei estadual 997/1976 e Decreto estadual 8.468/1976', quando: 'Antes de instalar/operar; o Facilita SP indica se há licenciamento.', link: 'https://cetesb.sp.gov.br/licenciamento/', nivel: 'verificar' },
    { id: 'telecom', titulo: 'Telecomunicações e internet', cnae: ['61'], palavras: /telecomunica|provedor de (acesso|internet)|internet/,
      orgao: 'ANATEL', exige: 'Outorga/autorização da ANATEL (ex.: SCM). Pequenos provedores podem ser dispensados, mas precisam comunicar a ANATEL.',
      base: 'Lei 9.472/1997 e regulamentos da ANATEL', quando: 'Antes de prestar o serviço.', link: 'https://www.gov.br/anatel/', nivel: 'verificar' },
    { id: 'ensino', titulo: 'Educação regular', cnae: ['851', '852', '853', '854'], palavras: /educa[cç][aã]o infantil|ensino fundamental|ensino m[eé]dio|ensino superior|ensino t[eé]cnico/,
      orgao: 'Secretaria/Conselho de Educação (ou MEC no ensino superior)', exige: 'Autorização de funcionamento do órgão de ensino. Cursos livres (8599) não precisam.',
      base: 'Lei 9.394/1996 (LDB)', quando: 'Antes de matricular alunos.', nivel: 'obrigatorio' },
  ];

  // Códigos CNAE citados num texto ("8640-2/12", "86.40-2-12", "8640212") → 7 dígitos
  function cnaesDoTexto(texto) {
    const s = String(texto || '');
    const re = /(?<!\d)(\d{2})\.?(\d{2})-?(\d)[\/-]?(\d{2})(?!\d)/g;
    const out = new Set(); let m;
    while ((m = re.exec(s))) out.add(m[1] + m[2] + m[3] + m[4]);
    return [...out];
  }

  const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  // Alertas para um objeto social (texto ou lista de atividades). Regra casa pelo CNAE; sem CNAE no texto, pelas palavras.
  function alertas(objeto) {
    const linhas = (Array.isArray(objeto) ? objeto : [objeto]).map(String).filter(s => s.trim());
    const achados = new Map();
    for (const linha of linhas) {
      const codigos = cnaesDoTexto(linha);
      const texto = semAcento(linha);
      for (const r of REGRAS) {
        const porCnae = codigos.filter(c => r.cnae.some(p => c.startsWith(p)));
        const porPalavra = !codigos.length && r.palavras && r.palavras.test(texto);
        if (!porCnae.length && !porPalavra) continue;
        const a = achados.get(r.id) || { ...r, cnaes: [], atividades: [] };
        porCnae.forEach(c => a.cnaes.includes(c) || a.cnaes.push(c));
        a.atividades.push(linha);
        achados.set(r.id, a);
      }
    }
    const ordem = { bloqueia: 0, obrigatorio: 1, verificar: 2 };
    return [...achados.values()].sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);
  }

  // Busca na lista completa (procedimento): por código CNAE ou palavra
  function buscar(termo) {
    const t = semAcento(termo).trim();
    if (!t) return REGRAS.slice();
    const dig = t.replace(/\D/g, '');
    return REGRAS.filter(r => (dig.length >= 2 && r.cnae.some(p => dig.startsWith(p) || p.startsWith(dig))) ||
      semAcento([r.titulo, r.orgao, r.exige].join(' ')).includes(t) || (r.palavras && r.palavras.test(t)));
  }

  const formatarCnae = c => c.length === 7 ? `${c.slice(0, 4)}-${c[4]}/${c.slice(5)}` : c;

  const api = { REGRAS, alertas, buscar, cnaesDoTexto, formatarCnae };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LicencasSoc = api;
})(typeof window !== 'undefined' ? window : globalThis);
