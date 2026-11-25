/*
 * Modelos de documentos societários (sem tela): monta o texto em blocos a partir dos dados
 * preenchidos no portal. A mesma lista de blocos vira a prévia na tela e o .docx.
 *
 * Bloco: { tipo: 'titulo' | 'centro' | 'secao' | 'p' | 'item' | 'tabela' | 'assinatura' | 'quebra', partes, linhas }
 * Parte: string ou { falta: 'rótulo' } — campo não preenchido, sai em vermelho para conferir.
 *
 * Documentos (sociedade limitada, um ou mais sócios):
 *   constituicao  — contrato social
 *   alteracao     — alteração contratual (cessão de quotas, entrada/saída de sócio, nome, sede,
 *                   objeto, capital, administração) com consolidação
 *   transformacao — empresário individual em LTDA (Modelo 2 do Manual de EI, IN DREI nº 81/2020)
 *   extincao      — distrato social (elementos da exigência 26.1 da JUCESP)
 * Texto das cláusulas fixo e revisado: o que muda são só os dados do formulário.
 *
 * Dados: {
 *   tipo, numero_alteracao, local, data,
 *   empresa: { nome, nome_ei, cnpj, nire, logradouro, numero, complemento, bairro, municipio, uf, cep, iptu, area,
 *              objeto: [], forma_atuacao, inicio, capital, valor_quota, integralizacao, integralizacao_prazo,
 *              enquadramento, foro, administracao, advogado },
 *   socios: [{ nome, sexo, nacionalidade, estado_civil, regime_bens, profissao, nascimento, naturalidade, rg, cpf,
 *              endereco, quotas, administrador, situacao: 'permanece' | 'entra' | 'sai' }],
 *   alteracao: { muda: { nome, endereco, objeto, capital, socios, administracao }, nome_novo, endereco_novo: {…},
 *                objeto_novo: [], capital_novo, cessoes: [{ cedente, cessionario, quotas, valor, gratuita }], consolidar },
 *   distrato: { data_encerramento, haveres: 'nao_ha' | 'partilha', partilha_texto, ativo_passivo, livros_nome, livros_endereco },
 *   clausulas_adicionais: [{ titulo, texto }],
 * }
 */
(function (root) {
  // ── número por extenso ──
  const UN = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze',
    'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const DEZ = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const CEM = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

  function ate999(n, fem) {
    if (n === 100) return 'cem';
    const c = Math.floor(n / 100), r = n % 100, p = [];
    if (c) p.push(fem ? CEM[c].replace(/os$/, 'as') : CEM[c]);
    if (r < 20) { if (r) p.push(UN[r]); }
    else { p.push(DEZ[Math.floor(r / 10)]); if (r % 10) p.push(UN[r % 10]); }
    let s = p.join(' e ');
    if (fem) s = s.replace(/\bum$/, 'uma').replace(/\bdois$/, 'duas');
    return s;
  }

  // Inteiro por extenso; fem = true para quantidades femininas ("duzentas mil quotas")
  function extenso(n, fem) {
    n = Math.floor(Math.abs(n));
    if (n === 0) return 'zero';
    const grupos = [];
    while (n > 0) { grupos.push(n % 1000); n = Math.floor(n / 1000); }
    const nomes = [['', ''], ['mil', 'mil'], ['milhão', 'milhões'], ['bilhão', 'bilhões']];
    const partes = [];
    for (let i = grupos.length - 1; i >= 0; i--) {
      const g = grupos[i];
      if (!g) continue;
      const txt = i === 1 && g === 1 ? 'mil' : (ate999(g, fem && i < 2) + (i ? ' ' + nomes[i][g === 1 ? 0 : 1] : ''));
      partes.push({ txt, g });
    }
    return partes.map((p, i) => (i && i === partes.length - 1 && (p.g < 100 || p.g % 100 === 0) ? 'e ' : '') + p.txt).join(' ');
  }

  function reaisExtenso(valor) {
    const cent = Math.round(Number(valor) * 100), r = Math.floor(cent / 100), c = cent % 100;
    const de = r >= 1e6 && r % 1e6 === 0 ? ' de' : '';
    const pr = r ? extenso(r) + de + (r === 1 ? ' real' : ' reais') : '';
    const pc = c ? extenso(c) + (c === 1 ? ' centavo' : ' centavos') : '';
    return [pr, pc].filter(Boolean).join(' e ') || 'zero reais';
  }

  const ORD = ['Primeira', 'Segunda', 'Terceira', 'Quarta', 'Quinta', 'Sexta', 'Sétima', 'Oitava', 'Nona'];
  function ordinal(n) {
    if (n < 10) return ORD[n - 1];
    const dez = ['', 'Décima', 'Vigésima', 'Trigésima', 'Quadragésima'][Math.floor(n / 10)];
    return n % 10 ? `${dez} ${ORD[n % 10 - 1]}` : dez;
  }

  // ── formatação e limpeza ──
  const limpa = s => String(s ?? '').replace(/\s+/g, ' ').trim();
  const moeda = v => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const inteiro = v => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  const v = (valor, rotulo) => (limpa(valor) !== '' ? limpa(valor) : { falta: rotulo });
  const NOME = (s, rotulo) => v(limpa(s).toUpperCase(), rotulo);
  const reais = x => `R$ ${moeda(x)} (${reaisExtenso(x)})`;

  function endereco(e, rotulo = 'endereço completo com CEP') {
    if (!e || !limpa(e.logradouro)) return { falta: rotulo };
    const p = [limpa(e.logradouro) + (limpa(e.numero) ? ', nº ' + limpa(e.numero) : ''), limpa(e.complemento), limpa(e.bairro),
      [limpa(e.municipio), limpa(e.uf).toUpperCase()].filter(Boolean).join('/'), limpa(e.cep) ? 'CEP ' + limpa(e.cep) : ''];
    return p.filter(Boolean).join(', ');
  }

  const fem = s => s.sexo === 'F';
  // Qualificação da pessoa física (Manual de LTDA, item 3: nome, nacionalidade, estado civil e regime,
  // data de nascimento se solteiro, profissão, CPF e endereço; RG e naturalidade como complemento)
  function qualificacao(s) {
    const casado = /casad|uni[aã]o est[aá]vel/i.test(s.estado_civil || '');
    const f = fem(s);
    return [
      NOME(s.nome, 'nome do sócio'), ', ', v(s.nacionalidade, 'nacionalidade'), ', ', v(s.estado_civil, 'estado civil'),
      ...(casado ? [', sob o regime de ', v(s.regime_bens, 'regime de bens')] : []),
      ', ', v(s.profissao, 'profissão'),
      f ? ', nascida em ' : ', nascido em ', v(s.nascimento, 'data de nascimento'),
      ...(limpa(s.naturalidade) ? [', natural de ', limpa(s.naturalidade)] : []),
      f ? ', portadora da cédula de identidade RG nº ' : ', portador da cédula de identidade RG nº ', v(s.rg, 'RG e órgão emissor'),
      f ? ', inscrita no CPF sob o nº ' : ', inscrito no CPF sob o nº ', v(s.cpf, 'CPF'),
      f ? ', residente e domiciliada na ' : ', residente e domiciliado na ', v(s.endereco, 'endereço residencial com CEP'),
    ];
  }
  // junta várias qualificações: "A; B e C"
  function juntarQualificacoes(socios) {
    const out = [];
    socios.forEach((s, i) => {
      if (i) out.push(i === socios.length - 1 ? '; e ' : '; ');
      out.push(...qualificacao(s));
    });
    return out;
  }
  const listaNomes = nomes => nomes.length <= 1 ? nomes.join('') : nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1];

  const PODERES = [
    'abrir, movimentar e encerrar contas correntes e/ou contas de pagamento, inclusive por meio de cartão de crédito e/ou débito;',
    'realizar transferências ou cobranças via DOC, TED, Pix e/ou qualquer outro meio;',
    'contratar ou renegociar empréstimos e/ou financiamentos;',
    'realizar ou resgatar aplicações financeiras e/ou investimentos;',
    'contratar ou cancelar seguros;',
    'outorgar procurações que contenham os poderes previstos acima;',
    'prestar garantias;',
    'solicitar a aquisição de novos produtos financeiros.',
  ];
  const IMPEDIMENTOS = 'não está impedido de exercer a administração da sociedade, por lei especial, ou em virtude de condenação ' +
    'criminal, ou por se encontrar sob os efeitos dela, a pena que vede, ainda que temporariamente, o acesso a cargos públicos; ou ' +
    'por crime falimentar, de prevaricação, peita ou suborno, concussão, peculato, ou contra a economia popular, contra o sistema ' +
    'financeiro nacional, contra normas de defesa da concorrência, contra as relações de consumo, fé pública, ou a propriedade.';

  // ── numeração das cláusulas ──
  function numerador() {
    let n = 0;
    return () => `Cláusula ${ordinal(++n)} – `;
  }

  const P = (...partes) => ({ tipo: 'p', partes });
  const S = txt => ({ tipo: 'secao', partes: [txt] });
  const I = (...partes) => ({ tipo: 'item', partes });
  const T = (...partes) => ({ tipo: 'titulo', partes });
  const CEN = (...partes) => ({ tipo: 'centro', partes });

  function capitalInfo(e) {
    const capital = Number(e.capital) || 0, vq = Number(e.valor_quota) || 1;
    return { capital, vq, quotas: capital ? Math.round(capital / vq) : 0 };
  }

  function tabelaQuotas(socios, vq) {
    const linhas = [['Sócio', 'Nº de quotas', 'Valor (R$)']];
    let tq = 0;
    socios.forEach(s => {
      const q = Number(s.quotas) || 0; tq += q;
      linhas.push([NOME(s.nome, 'nome do sócio'), q ? inteiro(q) : { falta: 'quotas' }, q ? moeda(q * vq) : { falta: 'valor' }]);
    });
    linhas.push(['Total', tq ? inteiro(tq) : { falta: 'quotas' }, tq ? moeda(tq * vq) : { falta: 'valor' }]);
    return { tipo: 'tabela', linhas };
  }

  // Corpo do contrato social (constituição, consolidação e transformação)
  // modo: 'constituicao' | 'consolidacao' | 'transformacao'
  function corpoContrato(d, socios, modo, c) {
    const e = d.empresa || {};
    const { capital, vq, quotas } = capitalInfo(e);
    const um = socios.length === 1;
    const admins = socios.filter(s => s.administrador);
    const nomesAdm = admins.map(s => limpa(s.nome).toUpperCase()).filter(Boolean);
    const objeto = (e.objeto || []).map(limpa).filter(Boolean);
    const enq = { ME: 'MICROEMPRESA', EPP: 'EMPRESA DE PEQUENO PORTE' }[e.enquadramento];
    const b = [];

    b.push(S('DO NOME EMPRESARIAL'), P(c(), 'A sociedade adota o nome empresarial ', NOME(e.nome, 'nome empresarial'), '.'));
    b.push(S('DA SEDE'), P(c(), 'A sociedade tem sede na ', endereco(e, 'endereço da sede com CEP'),
      ', podendo abrir filiais em qualquer parte do território nacional, mediante alteração contratual.'));
    b.push(S('DO OBJETO SOCIAL'), P(c(), 'A sociedade tem por objeto o exercício das seguintes atividades econômicas:'));
    if (objeto.length) objeto.forEach((x, i) => b.push(I(x.replace(/[;.]$/, '') + (i === objeto.length - 1 ? '.' : ';'))));
    else b.push(I({ falta: 'atividades (uma por linha)' }));
    b.push(P('Parágrafo único. As atividades serão exercidas ', v(e.forma_atuacao, 'forma de atuação'), '.'));

    b.push(S('DO INÍCIO DAS ATIVIDADES E DO PRAZO'));
    if (modo === 'constituicao') b.push(P(c(), limpa(e.inicio)
      ? `A sociedade iniciará suas atividades em ${limpa(e.inicio)} e seu prazo de duração é indeterminado.`
      : 'A sociedade iniciará suas atividades na data do registro na Junta Comercial e seu prazo de duração é indeterminado.'));
    else b.push(P(c(), limpa(e.inicio) ? `A sociedade iniciou suas atividades em ${limpa(e.inicio)} e seu prazo de duração é indeterminado.`
      : 'O prazo de duração da sociedade é indeterminado.'));

    const integ = modo === 'constituicao' && e.integralizacao === 'prazo'
      ? ['totalmente subscrito e a ser integralizado pelos sócios, em moeda corrente do País, até ', v(e.integralizacao_prazo, 'data limite da integralização')]
      : [modo === 'constituicao' ? 'totalmente subscrito e integralizado, neste ato, em moeda corrente do País'
        // na transformação o capital é o acervo do empresário individual (não dinheiro novo)
        : modo === 'transformacao' ? 'totalmente subscrito e integralizado com o acervo do empresário individual transformado'
          : 'totalmente subscrito e integralizado em moeda corrente do País'];
    b.push(S('DO CAPITAL SOCIAL'), P(c(), 'O capital social é de ', capital ? reais(capital) : { falta: 'capital social' }, ', dividido em ',
      quotas ? `${inteiro(quotas)} (${extenso(quotas, true)}) quotas` : { falta: 'número de quotas' }, ' de valor nominal de ', reais(vq), ' cada uma, ',
      ...integ, um ? ', pelo sócio único, assim distribuído:' : ', assim distribuído entre os sócios:'));
    b.push(tabelaQuotas(socios, vq));
    b.push(P(um ? 'Parágrafo único. A responsabilidade do sócio é restrita ao valor de suas quotas, respondendo solidariamente pela integralização do capital social, nos termos do art. 1.052 do Código Civil, ficando expresso que o sócio não responde subsidiariamente pelas obrigações sociais.'
      : 'Parágrafo único. A responsabilidade de cada sócio é restrita ao valor de suas quotas, mas todos respondem solidariamente pela integralização do capital social, nos termos do art. 1.052 do Código Civil.'));
    if (!um) b.push(P(c(), 'As quotas são indivisíveis e não poderão ser cedidas ou transferidas a terceiros sem o consentimento dos demais sócios, ',
      'a quem fica assegurado, em igualdade de condições e preço, o direito de preferência para a sua aquisição.'));

    b.push(S('DA ADMINISTRAÇÃO'));
    const modoAdm = nomesAdm.length > 1 ? (e.administracao === 'conjuntamente' ? ', em conjunto' : ', isoladamente') : ', isoladamente';
    b.push(P(c(), 'A administração da sociedade caberá ', nomesAdm.length > 1 ? 'aos sócios ' : 'ao sócio ',
      nomesAdm.length ? listaNomes(nomesAdm) : { falta: 'administrador (marque ao menos um sócio)' }, modoAdm,
      ', com poderes para representar a sociedade, ativa e passivamente, em juízo ou fora dele, e praticar todos os atos pertinentes à gestão relacionados ao objeto social, dentre eles:'));
    PODERES.forEach(x => b.push(I(x)));
    b.push(P('Parágrafo primeiro. Não constituindo o objeto social, a alienação ou a oneração de bens imóveis depende de autorização ', um ? 'do sócio.' : 'da maioria do capital social.'));
    b.push(P('Parágrafo segundo. É vedado o uso do nome empresarial em atividades estranhas ao interesse social, tais como avais, fianças, endossos ou outras garantias de favor em benefício de terceiros.'));
    b.push(P(c(), um ? 'O sócio poderá fixar retirada mensal, a título de pró-labore, observadas as disposições regulamentares pertinentes.'
      : 'Os sócios poderão, de comum acordo, fixar retirada mensal, a título de pró-labore, observadas as disposições regulamentares pertinentes.'));

    b.push(S('DO BALANÇO PATRIMONIAL E DOS LUCROS'), P(c(), 'Ao término de cada exercício social, em 31 de dezembro, o administrador prestará contas justificadas de sua administração, ',
      'procedendo à elaboração do inventário, do balanço patrimonial e do balanço de resultado econômico, cabendo ',
      um ? 'ao sócio os lucros ou perdas apurados.' : 'aos sócios, na proporção de suas quotas, os lucros ou perdas apurados.'));
    if (!um) b.push(S('DO FALECIMENTO OU INTERDIÇÃO DE SÓCIO'), P(c(), 'Falecendo ou sendo interditado qualquer sócio, a sociedade continuará suas atividades com os herdeiros, sucessores ou o incapaz. ',
      'Não sendo possível ou inexistindo interesse destes ou dos sócios remanescentes, o valor de seus haveres será apurado e liquidado com base na situação patrimonial da sociedade, ',
      'à data da resolução, verificada em balanço especialmente levantado.'));
    if (enq) b.push(S('DO ENQUADRAMENTO COMO ' + enq), P(c(), um ? 'O sócio declara' : 'Os sócios declaram',
      `, sob as penas da lei, que a sociedade se enquadra como ${enq}, nos termos da Lei Complementar nº 123, de 14 de dezembro de 2006, e que não se enquadra em nenhuma das hipóteses de exclusão previstas no § 4º do art. 3º da referida lei.`));
    b.push(S('DA DECLARAÇÃO DE DESIMPEDIMENTO'), P(c(), nomesAdm.length > 1 ? 'Os administradores declaram, sob as penas da lei, que não estão impedidos' : 'O administrador declara, sob as penas da lei, que ',
      nomesAdm.length > 1 ? IMPEDIMENTOS.replace('não está impedido', '').replace(/^ /, ' ') : IMPEDIMENTOS));
    adicionais(d, c).forEach(x => b.push(x));
    b.push(S('DO FORO'), P(c(), 'Fica eleito o foro da Comarca de ', v(e.foro, 'comarca do foro'),
      ' para dirimir quaisquer dúvidas decorrentes deste contrato, com renúncia a qualquer outro, por mais privilegiado que seja.'));
    return b;
  }

  function adicionais(d, c) {
    const b = [];
    (d.clausulas_adicionais || []).filter(x => limpa(x.texto)).forEach(x => {
      if (limpa(x.titulo)) b.push(S(limpa(x.titulo).toUpperCase()));
      b.push(P(c(), limpa(x.texto)));
    });
    return b;
  }

  function fecho(d, socios, plural) {
    const b = [P(plural ? 'E, por estarem assim justos e contratados, assinam o presente instrumento particular, em via única, por meio digital.'
      : 'E, por estar assim ajustado, o sócio assina o presente instrumento particular, em via única, por meio digital.'),
    P(v(d.local, 'cidade/UF'), ', ', v(d.data, 'data por extenso'), '.')];
    socios.forEach(s => b.push({ tipo: 'assinatura', partes: [NOME(s.nome, 'nome do sócio')], cargo: s.cargo || (s.administrador ? 'Sócio e administrador' : 'Sócio') }));
    const e = d.empresa || {};
    if (d.tipo !== 'extincao' && !e.enquadramento && ['constituicao', 'transformacao'].includes(d.tipo))
      b.push(P('Visto: ', v(e.advogado, 'nome e OAB do advogado (obrigatório quando não é ME/EPP)')));
    return b;
  }

  const ativos = d => (d.socios || []).filter(s => s.situacao !== 'sai');

  // ── 1. Contrato social (constituição) ──
  function constituicao(d) {
    const socios = ativos(d), um = socios.length === 1, e = d.empresa || {}, c = numerador();
    return [
      T('CONTRATO SOCIAL DE CONSTITUIÇÃO'),
      T(NOME(e.nome, 'nome empresarial')),
      P(...(socios.length ? juntarQualificacoes(socios) : [{ falta: 'sócios' }]),
        um ? ', resolve constituir uma sociedade limitada unipessoal, mediante as condições e cláusulas seguintes:'
          : ', resolvem constituir uma sociedade limitada, mediante as condições e cláusulas seguintes:'),
      ...corpoContrato(d, socios, 'constituicao', c),
      ...fecho(d, socios, !um),
    ];
  }

  // Qualificação da sociedade no preâmbulo (nome, sede, NIRE e CNPJ)
  const qualSociedade = (e, nomeAtual) => [' da sociedade limitada ', NOME(nomeAtual, 'nome empresarial atual'), ', com sede na ',
    endereco(e, 'sede atual com CEP'), ', registrada na Junta Comercial do Estado de São Paulo sob o NIRE ', v(e.nire, 'NIRE'),
    ', inscrita no CNPJ sob o nº ', v(e.cnpj, 'CNPJ')];

  // ── 2. Alteração contratual ──
  function alteracao(d) {
    const e = d.empresa || {}, a = d.alteracao || {}, m = a.muda || {}, c = numerador();
    const todos = d.socios || [];
    const antigos = todos.filter(s => s.situacao !== 'entra'), novos = todos.filter(s => s.situacao === 'entra');
    const plural = todos.length > 1;
    const b = [
      T(v(d.numero_alteracao, 'nº'), 'ª ALTERAÇÃO CONTRATUAL'),
      T(NOME(e.nome, 'nome empresarial atual')),
      CEN('CNPJ ', v(e.cnpj, 'CNPJ'), ' — NIRE ', v(e.nire, 'NIRE')),
      P(...(antigos.length ? juntarQualificacoes(antigos) : [{ falta: 'sócios atuais' }]), antigos.length > 1 ? ', únicos sócios' : ', único sócio',
        ...qualSociedade(e, e.nome),
        ...(novos.length ? ['; e, na qualidade de ingressante' + (novos.length > 1 ? 's' : ''), ', ', ...juntarQualificacoes(novos)] : []),
        plural ? ', resolvem, de comum acordo, alterar o contrato social mediante as cláusulas e condições seguintes:'
          : ', resolve alterar o contrato social mediante as cláusulas e condições seguintes:'),
    ];
    const vq = Number(e.valor_quota) || 1;
    if (m.socios) (a.cessoes || []).forEach(x => {
      const ced = todos.find(s => limpa(s.nome).toUpperCase() === limpa(x.cedente).toUpperCase());
      const ces = todos.find(s => limpa(s.nome).toUpperCase() === limpa(x.cessionario).toUpperCase());
      const q = Number(x.quotas) || 0;
      b.push(P(c(), 'O sócio ', NOME(x.cedente, 'cedente'), x.gratuita ? ' cede e transfere, a título gratuito, ' : ' cede e transfere, a título oneroso, ',
        q ? `${inteiro(q)} (${extenso(q, true)}) quotas, no valor nominal total de ${reais(q * vq)},` : { falta: 'quotas cedidas' },
        ces && ces.situacao === 'entra' ? ' ao ingressante ' : ' ao sócio ', NOME(x.cessionario, 'cessionário'),
        x.gratuita ? '' : (Number(x.valor) ? `, pelo preço de ${reais(Number(x.valor))}` : ''),
        ced && ced.situacao === 'sai' ? ', retirando-se da sociedade e dando plena, geral e irrevogável quitação.' : ', dando plena quitação quanto às quotas cedidas.'));
    });
    if (m.nome) b.push(P(c(), 'A sociedade passa a adotar o nome empresarial ', NOME(a.nome_novo, 'novo nome empresarial'), '.'));
    if (m.endereco) b.push(P(c(), 'A sede da sociedade é transferida para ', endereco(a.endereco_novo, 'novo endereço da sede com CEP'), '.'));
    if (m.objeto) {
      const ob = (a.objeto_novo || []).map(limpa).filter(Boolean);
      b.push(P(c(), 'O objeto social passa a ser o exercício das seguintes atividades econômicas:'));
      if (ob.length) ob.forEach((x, i) => b.push(I(x.replace(/[;.]$/, '') + (i === ob.length - 1 ? '.' : ';'))));
      else b.push(I({ falta: 'novo objeto (uma atividade por linha)' }));
    }
    if (m.capital) {
      const ant = Number(e.capital) || 0, novo = Number(a.capital_novo) || 0;
      b.push(P(c(), 'O capital social, que era de ', ant ? reais(ant) : { falta: 'capital atual' }, ', passa a ser de ',
        novo ? reais(novo) : { falta: 'novo capital' }, novo && ant ? `, com aumento de ${reais(novo - ant)}` : '',
        ', totalmente subscrito e integralizado, neste ato, em moeda corrente do País, conforme o quadro de quotas do contrato consolidado.'));
    }
    if (m.administracao) {
      const adm = ativos(d).filter(s => s.administrador).map(s => limpa(s.nome).toUpperCase());
      b.push(P(c(), 'A administração da sociedade passa a ser exercida ', adm.length > 1 ? 'pelos sócios ' : 'pelo sócio ',
        adm.length ? listaNomes(adm) : { falta: 'administrador' }, adm.length > 1 ? (e.administracao === 'conjuntamente' ? ', em conjunto.' : ', isoladamente.') : ', isoladamente.'));
    }
    if (!(m.nome || m.endereco || m.objeto || m.capital || m.socios || m.administracao)) b.push(P({ falta: 'marque o que muda nesta alteração' }));
    if (a.consolidar === false) adicionais(d, c).forEach(x => b.push(x));
    else {
      // consolidação: o contrato inteiro com a situação final
      const final = { ...d, empresa: { ...e,
        nome: m.nome ? a.nome_novo : e.nome,
        ...(m.endereco ? a.endereco_novo || {} : {}),
        objeto: m.objeto ? a.objeto_novo : e.objeto,
        capital: m.capital ? a.capital_novo : e.capital } };
      b.push(P(c(), 'Em razão das alterações acima, ', plural ? 'os sócios resolvem' : 'o sócio resolve',
        ' consolidar o contrato social, que passa a vigorar com a seguinte redação:'));
      b.push({ tipo: 'titulo', partes: ['CONTRATO SOCIAL CONSOLIDADO'], quebra: true }, T(NOME(final.empresa.nome, 'nome empresarial')));
      corpoContrato(final, ativos(d), 'consolidacao', numerador()).forEach(x => b.push(x));
    }
    return [...b, ...fecho(d, todos, plural)];
  }

  // ── 3. Transformação de empresário individual em LTDA ──
  function transformacao(d) {
    const e = d.empresa || {}, s = (d.socios || [])[0] || {}, c = numerador();
    const socio = [{ ...s, administrador: true, quotas: s.quotas || capitalInfo(e).quotas, situacao: 'permanece' }];
    const { capital, vq, quotas } = capitalInfo(e);
    const nomeEi = NOME(e.nome_ei, 'nome empresarial atual (ficha da Junta)');
    return [
      T(v(d.numero_alteracao, 'nº'), 'ª ALTERAÇÃO DO INSTRUMENTO DE INSCRIÇÃO DE EMPRESÁRIO INDIVIDUAL'),
      T('TRANSFORMAÇÃO EM SOCIEDADE LIMITADA UNIPESSOAL'),
      CEN(nomeEi, ' — CNPJ ', v(e.cnpj, 'CNPJ'), ' — NIRE ', v(e.nire, 'NIRE')),
      P(...qualificacao(s), ', na qualidade de empresário individual ', nomeEi, ', com sede na ', endereco(e, 'sede com CEP'),
        ', registrado nesta Junta Comercial sob o NIRE ', v(e.nire, 'NIRE'), ', inscrito no CNPJ sob o nº ', v(e.cnpj, 'CNPJ'), ', resolve:'),
      P(c(), 'Transformar o registro de Empresário Individual em Sociedade Limitada, constituída por um único sócio, adotando o nome empresarial ',
        NOME(e.nome, 'novo nome empresarial LTDA'), ', com sede e domicílio na ', endereco(e, 'sede com CEP'), '.'),
      P(c(), 'O acervo do empresário ora transformado, no valor de ', capital ? reais(capital) : { falta: 'capital social' },
        ', passa a constituir o capital da sociedade, dividido em ', quotas ? `${inteiro(quotas)} (${extenso(quotas, true)}) quotas` : { falta: 'número de quotas' },
        ' de ', reais(vq), ' cada uma, assim distribuído:'),
      tabelaQuotas(socio, vq),
      P(c(), 'Em consequência da transformação aqui deliberada, resolve o sócio transcrever o contrato social, o qual, já refletindo as alterações acima, ',
        'passa a ser parte integrante do presente instrumento e a ter a seguinte redação:'),
      { tipo: 'titulo', partes: ['CONTRATO SOCIAL POR TRANSFORMAÇÃO DE EMPRESÁRIO INDIVIDUAL EM SOCIEDADE LIMITADA'], quebra: true },
      T(NOME(e.nome, 'novo nome empresarial LTDA')),
      CEN('CNPJ ', v(e.cnpj, 'CNPJ')),
      P(...qualificacao(s), ', único sócio, passa a constituir o tipo jurídico Sociedade Limitada, a qual se regerá, doravante, pelo presente contrato social, mediante as condições e cláusulas seguintes:'),
      ...corpoContrato(d, socio, 'transformacao', numerador()),
      ...fecho(d, socio, false),
    ];
  }

  // ── 4. Distrato social ──
  function extincao(d) {
    const e = d.empresa || {}, x = d.distrato || {}, c = numerador();
    const socios = d.socios || [], plural = socios.length > 1;
    const b = [
      T('DISTRATO SOCIAL'),
      T(NOME(e.nome, 'nome empresarial')),
      CEN('CNPJ ', v(e.cnpj, 'CNPJ'), ' — NIRE ', v(e.nire, 'NIRE')),
      P(...(socios.length ? juntarQualificacoes(socios) : [{ falta: 'sócios' }]), plural ? ', únicos sócios' : ', único sócio', ...qualSociedade(e, e.nome),
        plural ? ', resolvem, de comum acordo, dissolver e liquidar a sociedade, mediante as cláusulas e condições seguintes:'
          : ', resolve dissolver e liquidar a sociedade, mediante as cláusulas e condições seguintes:'),
      P(c(), 'A sociedade encerra suas atividades em ', v(x.data_encerramento, 'data de encerramento'), ', ficando dissolvida e extinta para todos os fins de direito.'),
      x.haveres === 'partilha'
        ? P(c(), 'Procedida a liquidação, o ativo remanescente foi partilhado entre ', plural ? 'os sócios, na proporção de suas quotas, da seguinte forma: ' : 'o sócio, da seguinte forma: ',
          v(x.partilha_texto, 'como foi a partilha (bens/valores e para quem)'), '.')
        : P(c(), 'Procedida a liquidação, não há bens nem haveres a restituir ', plural ? 'aos sócios' : 'ao sócio', ', tendo o ativo sido utilizado no pagamento do passivo.'),
      P(c(), 'O ativo e o passivo remanescentes, se vierem a surgir, ficarão sob a responsabilidade de ', NOME(x.ativo_passivo, 'responsável pelo ativo e passivo remanescentes'), '.'),
      P(c(), 'A guarda dos livros e documentos da sociedade ficará a cargo de ', NOME(x.livros_nome, 'responsável pela guarda dos livros'),
        ', no endereço ', v(x.livros_endereco, 'endereço da guarda dos livros'), '.'),
      P(c(), plural ? 'Os sócios dão-se mútua, plena, geral e irrevogável quitação, para nada mais reclamarem, a qualquer título, com relação à sociedade ora extinta.'
        : 'O sócio dá plena, geral e irrevogável quitação, para nada mais reclamar, a qualquer título, com relação à sociedade ora extinta.'),
      ...adicionais(d, c),
    ];
    return [...b, ...fecho(d, socios, plural)];
  }

  // ── validação dos dados (antes de gerar) ──
  function cpfValido(cpf) {
    const x = String(cpf || '').replace(/\D/g, '');
    if (x.length !== 11 || /^(\d)\1+$/.test(x)) return false;
    const dv = n => { let s = 0; for (let i = 0; i < n; i++) s += +x[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
    return dv(9) === +x[9] && dv(10) === +x[10];
  }
  const dataOk = s => { const m = limpa(s).match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if (!m) return false; const dt = new Date(+m[3], +m[2] - 1, +m[1]); return dt.getDate() === +m[1] && dt.getMonth() === +m[2] - 1; };

  function validar(d) {
    const out = [], e = d.empresa || {}, t = d.tipo;
    const add = (nivel, msg) => out.push({ nivel, msg });
    const socios = d.socios || [];
    if (!socios.length) add('erro', 'Inclua pelo menos um sócio.');
    (d.clausulas_adicionais || []).forEach((c, i) => {
      if (/\[[^\]]*\]/.test(c.texto || '')) add('erro', `Cláusula adicional ${i + 1}${c.titulo ? ' (' + c.titulo + ')' : ''}: complete ou apague o que está entre colchetes.`);
    });
    socios.forEach((s, i) => {
      const quem = limpa(s.nome) || `sócio ${i + 1}`;
      if (limpa(s.cpf) && !cpfValido(s.cpf)) add('erro', `CPF inválido: ${quem} (${s.cpf}).`);
      if (limpa(s.nascimento) && !dataOk(s.nascimento)) add('erro', `Data de nascimento em formato errado: ${quem}. Use dd/mm/aaaa.`);
      if (/casad/i.test(s.estado_civil || '') && !limpa(s.regime_bens)) add('erro', `Informe o regime de bens de ${quem} (${limpa(s.estado_civil)}).`);
      if (limpa(s.nome) && limpa(s.nome).split(' ').length < 2) add('atencao', `Nome incompleto: ${quem}. Use o nome civil completo.`);
    });
    if (limpa(e.cep) && !/^\d{2}\.?\d{3}-?\d{3}$/.test(limpa(e.cep))) add('erro', `CEP da sede em formato errado: ${e.cep}.`);
    if (t !== 'extincao') {
      const { capital, vq } = capitalInfo(t === 'alteracao' && d.alteracao && d.alteracao.muda && d.alteracao.muda.capital ? { ...e, capital: d.alteracao.capital_novo } : e);
      const at = ativos(d);
      const soma = t === 'transformacao' ? (Number((socios[0] || {}).quotas) || capital / vq) : at.reduce((s, x) => s + (Number(x.quotas) || 0), 0);
      if (capital && Math.abs(soma * vq - capital) > 0.004) add('erro', `A soma das quotas (${inteiro(soma)} × R$ ${moeda(vq)} = R$ ${moeda(soma * vq)}) não fecha com o capital (R$ ${moeda(capital)}).`);
      if (vq < 0.01) add('erro', 'O valor da quota não pode ser menor que um centavo (Manual de LTDA, item 4.2.2).');
      if (t !== 'transformacao' && !at.some(s => s.administrador)) add('erro', 'Marque pelo menos um sócio como administrador.');
      if (limpa(e.inicio) && !dataOk(e.inicio)) add('erro', 'Data de início em formato errado. Use dd/mm/aaaa.');
      if (!e.enquadramento && ['constituicao', 'transformacao'].includes(t) && !limpa(e.advogado)) add('atencao', 'Sem enquadramento ME/EPP: o contrato precisa do visto de advogado (nome e OAB).');
      if (t === 'constituicao' && e.integralizacao === 'prazo' && !dataOk(e.integralizacao_prazo)) add('erro', 'Informe a data limite da integralização (dd/mm/aaaa).');
    }
    if (t === 'alteracao') {
      const m = (d.alteracao || {}).muda || {};
      if (!Object.values(m).some(Boolean)) add('erro', 'Marque o que muda nesta alteração.');
      if (m.socios && !((d.alteracao || {}).cessoes || []).length && !socios.some(s => s.situacao === 'entra' || s.situacao === 'sai'))
        add('atencao', 'Mudança de sócios sem cessão de quotas nem entrada/saída marcada.');
      (d.alteracao.cessoes || []).forEach(x => {
        const ced = socios.find(s => limpa(s.nome).toUpperCase() === limpa(x.cedente).toUpperCase());
        const ces = socios.find(s => limpa(s.nome).toUpperCase() === limpa(x.cessionario).toUpperCase());
        if (!ced) add('erro', `Cedente "${x.cedente || '—'}" não está na lista de sócios.`);
        if (!ces) add('erro', `Cessionário "${x.cessionario || '—'}" não está na lista de sócios (inclua como ingressante).`);
      });
      if (socios.some(s => s.situacao === 'entra' || s.situacao === 'sai') && !m.socios) add('atencao', 'Há sócio entrando ou saindo: marque "Sócios / quotas" no que muda.');
    }
    if (t === 'transformacao' && socios.length !== 1) add('erro', 'O modelo de transformação é para um único sócio (o titular da empresa individual).');
    if (t === 'extincao') {
      const x = d.distrato || {};
      if (limpa(x.data_encerramento) && !dataOk(x.data_encerramento)) add('erro', 'Data de encerramento em formato errado. Use dd/mm/aaaa.');
    }
    return out;
  }

  // Campos que faltam preencher (rótulos únicos, na ordem em que aparecem)
  function faltando(blocos) {
    const s = new Set();
    const ver = p => { if (p && typeof p === 'object' && p.falta) s.add(p.falta); };
    blocos.forEach(b => { (b.partes || []).forEach(ver); (b.linhas || []).forEach(l => l.forEach(ver)); });
    return [...s];
  }

  const MODELOS = {
    constituicao: { nome: 'Abertura — contrato social (LTDA)', gerar: constituicao, arquivo: 'Contrato_Social' },
    alteracao: { nome: 'Alteração contratual (LTDA)', gerar: alteracao, arquivo: 'Alteracao_Contratual' },
    transformacao: { nome: 'Transformação de empresário individual em LTDA', gerar: transformacao, arquivo: 'Transformacao_EI_LTDA' },
    extincao: { nome: 'Encerramento — distrato social (LTDA)', gerar: extincao, arquivo: 'Distrato_Social' },
  };
  const gerar = d => (MODELOS[d.tipo] || MODELOS.constituicao).gerar(d);

  const api = { extenso, reaisExtenso, ordinal, qualificacao, gerar, validar, faltando, cpfValido, MODELOS,
    constituicao, alteracao, transformacao, extincao };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ModelosSoc = api;
})(typeof window !== 'undefined' ? window : globalThis);
