/*
 * Modelos de documentos societários (sem tela): monta o texto do documento em blocos,
 * a partir dos dados do formulário. A mesma lista de blocos vira a prévia na tela e o .docx.
 *
 * Bloco: { tipo: 'titulo' | 'centro' | 'secao' | 'p' | 'item' | 'tabela' | 'assinatura', partes, linhas }
 * Parte: string ou { falta: 'rótulo' } — campo não preenchido, sai em vermelho para conferir.
 *
 * Modelo de transformação: "Modelo 2" do Manual de Registro de Empresário Individual
 * (IN DREI nº 81/2020, incluído pela IN DREI nº 01/2024) — ato de transformação e contrato
 * social da LTDA no mesmo instrumento, com a empresa individual qualificada no preâmbulo.
 */
(function (root) {
  // ── número por extenso (reais e quantidades) ──
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
    // "e" antes do último grupo quando ele é menor que 100 ou centena redonda
    return partes.map((p, i) => (i && i === partes.length - 1 && (p.g < 100 || p.g % 100 === 0) ? 'e ' : '') + p.txt).join(' ');
  }

  function reaisExtenso(valor) {
    const cent = Math.round(Number(valor) * 100), r = Math.floor(cent / 100), c = cent % 100;
    const de = r >= 1e6 && r % 1e6 === 0 ? ' de' : '';
    const pr = r ? extenso(r) + de + (r === 1 ? ' real' : ' reais') : '';
    const pc = c ? extenso(c) + (c === 1 ? ' centavo' : ' centavos') : '';
    return [pr, pc].filter(Boolean).join(' e ') || 'zero reais';
  }

  const moeda = v => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const inteiro = v => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 });

  // Valor do formulário ou marcador de "falta"
  const v = (valor, rotulo) => (valor != null && String(valor).trim() !== '' ? String(valor).trim() : { falta: rotulo });

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
  const DESIMPEDIMENTO = 'declara, sob as penas da lei, que não está impedido de exercer a administração da sociedade, por lei ' +
    'especial, ou em virtude de condenação criminal, ou por se encontrar sob os efeitos dela, a pena que vede, ainda que ' +
    'temporariamente, o acesso a cargos públicos; ou por crime falimentar, de prevaricação, peita ou suborno, concussão, peculato, ' +
    'ou contra a economia popular, contra o sistema financeiro nacional, contra normas de defesa da concorrência, contra as ' +
    'relações de consumo, fé pública, ou a propriedade.';

  // Qualificação da pessoa física (preâmbulo)
  function qualificacao(t) {
    const casado = /casad/i.test(t.estado_civil || '');
    return [
      v(t.nome && t.nome.toUpperCase(), 'nome do titular'), ', ', v(t.nacionalidade, 'nacionalidade'), ', ',
      v(t.estado_civil, 'estado civil'), ...(casado ? [', sob o regime de ', v(t.regime_bens, 'regime de bens')] : []),
      ', nascido em ', v(t.nascimento, 'data de nascimento'),
      ...(t.naturalidade ? [', natural de ', t.naturalidade] : []),
      ', portador da cédula de identidade RG nº ', v(t.rg, 'RG e órgão emissor'),
      ', inscrito no CPF sob o nº ', v(t.cpf, 'CPF'),
      ', residente e domiciliado na ', v(t.endereco, 'endereço residencial com CEP'),
    ];
  }

  function transformacaoEI(d) {
    const t = d.titular || {}, ei = d.ei || {}, l = d.ltda || {};
    const capital = Number(l.capital) || 0, vq = Number(l.valor_quota) || 1;
    const quotas = capital ? Math.round(capital / vq) : 0;
    const nomeTit = v(t.nome && t.nome.toUpperCase(), 'nome do titular');
    const nomeLtda = v(l.nome && l.nome.toUpperCase(), 'novo nome empresarial LTDA');
    const nomeEi = v(ei.nome && ei.nome.toUpperCase(), 'nome empresarial atual (ficha da Junta)');
    const sedeLtda = v(l.sede || ei.sede, 'endereço da sede com CEP');
    const cnpj = v(ei.cnpj, 'CNPJ'), nire = v(ei.nire, 'NIRE');
    const capTxt = capital ? `R$ ${moeda(capital)} (${reaisExtenso(capital)})` : { falta: 'capital social' };
    const quotasTxt = quotas ? `${inteiro(quotas)} (${extenso(quotas, true)}) quotas` : { falta: 'número de quotas' };
    const vqTxt = `R$ ${moeda(vq)} (${reaisExtenso(vq)})`;
    const tabela = { tipo: 'tabela', linhas: [
      ['Sócio', 'Nº de quotas', 'Valor (R$)'],
      [nomeTit, quotas ? inteiro(quotas) : { falta: 'quotas' }, capital ? moeda(capital) : { falta: 'valor' }],
      ['Total', quotas ? inteiro(quotas) : { falta: 'quotas' }, capital ? moeda(capital) : { falta: 'valor' }],
    ] };
    const objeto = (l.objeto || []).map(s => String(s).trim()).filter(Boolean);
    const ultimo = (lista, i) => (i === lista.length - 1 ? '.' : ';');
    const P = (...partes) => ({ tipo: 'p', partes });
    const S = txt => ({ tipo: 'secao', partes: [txt] });
    const I = (...partes) => ({ tipo: 'item', partes });
    const poderes = PODERES.map(x => I(x));
    const enq = { ME: 'MICROEMPRESA', EPP: 'EMPRESA DE PEQUENO PORTE' }[l.enquadramento];

    const blocos = [
      { tipo: 'titulo', partes: [v(d.numero_alteracao, 'nº'), 'ª ALTERAÇÃO DO INSTRUMENTO DE INSCRIÇÃO DE EMPRESÁRIO INDIVIDUAL'] },
      { tipo: 'titulo', partes: ['TRANSFORMAÇÃO EM SOCIEDADE LIMITADA' + (d.unipessoal === false ? '' : ' UNIPESSOAL')] },
      { tipo: 'centro', partes: [nomeEi, ' — CNPJ ', cnpj, ' — NIRE ', nire] },
      P(...qualificacao(t), ', na qualidade de empresário individual ', nomeEi, ', com sede na ', v(ei.sede, 'sede atual com CEP'),
        ', registrado nesta Junta Comercial sob o NIRE ', nire, ', inscrito no CNPJ sob o nº ', cnpj, ', resolve:'),
      P('Cláusula Primeira – Transformar o registro de Empresário Individual em Sociedade Limitada, constituída por um único sócio, ',
        'adotando o nome empresarial ', nomeLtda, ', com sede e domicílio na ', sedeLtda, '.'),
      P('Cláusula Segunda – O acervo do empresário ora transformado, no valor de ', capTxt, ', passa a constituir o capital da ',
        'sociedade, dividido em ', quotasTxt, ' de ', vqTxt, ' cada uma, assim distribuído:'),
      tabela,
      P('Cláusula Terceira – A administração da sociedade será exercida pelo sócio ', nomeTit, ', isoladamente, que representará ',
        'legalmente a sociedade, ativa e passivamente, em juízo ou fora dele, e poderá praticar todos os atos pertinentes à gestão ',
        'da sociedade relacionados ao objeto social, dentre eles:'),
      ...poderes,
      P('Parágrafo único. Não constituindo o objeto social, a alienação ou a oneração de bens imóveis depende de autorização do sócio.'),
      P('Cláusula Quarta – O administrador ', DESIMPEDIMENTO),
      P('Cláusula Quinta – Em consequência da transformação aqui deliberada, resolve o sócio transcrever o contrato social, o qual, ',
        'já refletindo as alterações acima, passa a ser parte integrante do presente instrumento e a ter a seguinte redação:'),

      { tipo: 'titulo', partes: ['CONTRATO SOCIAL POR TRANSFORMAÇÃO DE EMPRESÁRIO INDIVIDUAL EM SOCIEDADE LIMITADA'], quebra: true },
      { tipo: 'titulo', partes: [nomeLtda] },
      { tipo: 'centro', partes: ['CNPJ ', cnpj, ' — NIRE ', nire] },
      P(...qualificacao(t), ', único sócio, passa a constituir o tipo jurídico Sociedade Limitada, a qual se regerá, doravante, ',
        'pelo presente contrato social, mediante as condições e cláusulas seguintes:'),
      S('DO NOME EMPRESARIAL'),
      P('Cláusula Primeira – A sociedade adota o nome empresarial ', nomeLtda, '.'),
      S('DA SEDE'),
      P('Cláusula Segunda – A sociedade tem sede na ', sedeLtda, ', podendo abrir filiais em qualquer parte do território ',
        'nacional, mediante alteração contratual.'),
      S('DO OBJETO SOCIAL'),
      P('Cláusula Terceira – A sociedade tem por objeto o exercício das seguintes atividades econômicas:'),
      ...(objeto.length ? objeto.map((x, i) => I(x.replace(/[;.]$/, '') + ultimo(objeto, i))) : [I({ falta: 'atividades (uma por linha)' })]),
      P('Parágrafo único. As atividades serão exercidas ', v(l.forma_atuacao, 'forma de atuação'), '.'),
      S('DO INÍCIO DAS ATIVIDADES E DO PRAZO'),
      P('Cláusula Quarta – A sociedade iniciou suas atividades em ', v(l.inicio, 'data de início do CNPJ'),
        ' e seu prazo de duração é indeterminado.'),
      S('DO CAPITAL SOCIAL'),
      P('Cláusula Quinta – O capital social é de ', capTxt, ', dividido em ', quotasTxt, ' de valor nominal de ', vqTxt,
        ' cada uma, totalmente subscrito e integralizado pelo sócio único, em moeda corrente do País, assim distribuído:'),
      tabela,
      P('Parágrafo único. A responsabilidade do sócio é restrita ao valor de suas quotas, respondendo solidariamente pela ',
        'integralização do capital social, nos termos do art. 1.052 do Código Civil.'),
      S('DA ADMINISTRAÇÃO'),
      P('Cláusula Sexta – A administração da sociedade será exercida pelo sócio ', nomeTit, ', isoladamente, que representará ',
        'legalmente a sociedade, ativa e passivamente, em juízo ou fora dele, e poderá praticar todos os atos pertinentes à gestão ',
        'da sociedade relacionados ao objeto social, dentre eles:'),
      ...poderes,
      P('Parágrafo primeiro. Não constituindo o objeto social, a alienação ou a oneração de bens imóveis depende de autorização do sócio.'),
      P('Parágrafo segundo. É vedado o uso do nome empresarial em atividades estranhas ao interesse social, tais como avais, ',
        'fianças, endossos ou outras garantias de favor em benefício de terceiros.'),
      S('DO BALANÇO PATRIMONIAL'),
      P('Cláusula Sétima – Ao término de cada exercício, em 31 de dezembro, o administrador prestará contas justificadas de sua ',
        'administração, procedendo à elaboração do inventário, do balanço patrimonial e do balanço de resultado econômico, cabendo ',
        'ao sócio os lucros ou perdas apurados.'),
    ];
    let n = 8;
    const ord = ['Oitava', 'Nona', 'Décima', 'Décima Primeira'];
    if (enq) {
      blocos.push(S('DO ENQUADRAMENTO COMO ' + enq),
        P(`Cláusula ${ord[n - 8]} – O sócio declara, sob as penas da lei, que a sociedade se enquadra como ${enq}, nos termos da `,
          'Lei Complementar nº 123, de 14 de dezembro de 2006, e que não se enquadra em nenhuma das hipóteses de exclusão previstas ',
          'no § 4º do art. 3º da referida lei.'));
      n++;
    }
    blocos.push(
      S('DA DECLARAÇÃO DE DESIMPEDIMENTO DO ADMINISTRADOR'),
      P(`Cláusula ${ord[n - 8]} – O administrador `, DESIMPEDIMENTO),
      S('DO FORO'),
      P(`Cláusula ${ord[n - 7]} – Fica eleito o foro da Comarca de `, v(l.foro, 'comarca do foro'), ' para dirimir quaisquer ',
        'dúvidas decorrentes do presente instrumento, com renúncia a qualquer outro, por mais privilegiado que seja.'),
      P('E, por estar assim constituída, o sócio assina o presente instrumento particular, em via única, por meio digital.'),
      P(v(d.local, 'cidade/UF'), ', ', v(d.data, 'data por extenso'), '.'),
      { tipo: 'assinatura', partes: [nomeTit], cargo: 'Sócio e administrador' },
    );
    return blocos;
  }

  // Campos que faltam preencher (rótulos únicos, na ordem em que aparecem)
  function faltando(blocos) {
    const s = new Set();
    const ver = p => { if (p && typeof p === 'object' && p.falta) s.add(p.falta); };
    blocos.forEach(b => { (b.partes || []).forEach(ver); (b.linhas || []).forEach(l => l.forEach(ver)); });
    return [...s];
  }

  const MODELOS = {
    'transformacao-ei-ltda': {
      nome: 'Transformação de empresário individual em LTDA (sócio único)',
      tipo: 'transformacao',
      fonte: 'Manual de Registro de Empresário Individual, Modelo 2 (IN DREI nº 81/2020)',
      gerar: transformacaoEI,
    },
  };

  const api = { extenso, reaisExtenso, transformacaoEI, faltando, MODELOS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ModelosSoc = api;
})(typeof window !== 'undefined' ? window : globalThis);
