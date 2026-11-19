/*
 * Onboarding de clientes — do orçamento ao cliente implantado.
 * Regras puras (sem tela), testadas em tests/onboarding.test.js:
 *   etapas, cálculo do orçamento pela tabela de preços, escopo por regime, textos da proposta,
 *   do contrato e do e-mail de boas-vindas, e o checklist de implantação ligado às ferramentas do portal.
 *
 * Documento = lista de blocos { tipo: 'titulo'|'centro'|'secao'|'paragrafo'|'item'|'tabela'|'assinatura', partes|linhas }
 * (mesmo formato do societario/modelos-core.js, usado para a prévia e para o Word).
 * Parte de texto: string, ou { falta: 'rótulo' } quando o dado não foi preenchido (sai em vermelho).
 */
(function (root) {
  const ETAPAS = [
    { id: 'lead', nome: 'Qualificação', cor: '#94a3b8' },
    { id: 'orcamento', nome: 'Orçamento', cor: '#60a5fa' },
    { id: 'proposta', nome: 'Proposta enviada', cor: '#a78bfa' },
    { id: 'contrato', nome: 'Contrato', cor: '#fbbf24' },
    { id: 'implantacao', nome: 'Implantação', cor: '#2dd4bf' },
    { id: 'ativo', nome: 'Cliente ativo', cor: '#34d399' },
    { id: 'perdido', nome: 'Perdido', cor: '#f87171' },
  ];
  const REGIMES = ['MEI', 'Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'Imune/Isento'];

  // Tabela de preços padrão (valores em branco: o escritório preenche na tela "Tabela de preços")
  const PRECOS_PADRAO = {
    base: { 'MEI': 0, 'Simples Nacional|servicos': 0, 'Simples Nacional|comercio': 0, 'Lucro Presumido|servicos': 0, 'Lucro Presumido|comercio': 0, 'Lucro Real': 0, 'Imune/Isento': 0 },
    funcionarios_inclusos: 0, por_funcionario: 0, por_socio_prolabore: 0, por_filial: 0,
    faixas_notas: [{ ate: 50, valor: 0 }, { ate: 150, valor: 0 }, { ate: 400, valor: 0 }, { ate: null, valor: 0 }],
    servicos: [
      { id: 'abertura', nome: 'Abertura de empresa', cobranca: 'avulso', valor: 0 },
      { id: 'transformacao', nome: 'Transformação (MEI/EI em LTDA)', cobranca: 'avulso', valor: 0 },
      { id: 'alteracao', nome: 'Alteração contratual', cobranca: 'avulso', valor: 0 },
      { id: 'regularizacao', nome: 'Regularização de pendências e atrasos', cobranca: 'avulso', valor: 0 },
      { id: 'diagnostico', nome: 'Diagnóstico tributário', cobranca: 'avulso', valor: 0 },
      { id: 'bpo', nome: 'BPO financeiro', cobranca: 'mensal', valor: 0 },
      { id: 'irpf', nome: 'Declaração de IRPF dos sócios (por declaração)', cobranca: 'anual', valor: 0 },
      { id: 'recuperacao', nome: 'Recuperação tributária', cobranca: 'exito', percentual: 0 },
    ],
    decimo_terceiro: true, indice_reajuste: 'IPCA', validade_dias: 15, desconto_maximo: 10,
    multa_atraso: 2, juros_mes: 1, aviso_previo_dias: 30, dia_documentos: 5,
  };

  const arred = v => Math.round((+v || 0) * 100 + Number.EPSILON * 100) / 100;
  const brl = v => 'R$ ' + (+v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const P = (v, rotulo) => (v === 0 || (v && String(v).trim())) ? String(v) : { falta: rotulo };
  const juntar = (lista, sep = ', ', fim = ' e ') => lista.length <= 1 ? lista.join('') : lista.slice(0, -1).join(sep) + fim + lista[lista.length - 1];
  const mesclar = precos => ({ ...PRECOS_PADRAO, ...(precos || {}), base: { ...PRECOS_PADRAO.base, ...((precos || {}).base || {}) } });

  // Chave da tabela base: Simples e Presumido mudam conforme serviço x comércio/indústria
  function chaveBase(regime, atividade) {
    if (regime === 'Simples Nacional' || regime === 'Lucro Presumido') return `${regime}|${atividade === 'comercio' ? 'comercio' : 'servicos'}`;
    return regime;
  }

  /*
   * d (dados da oportunidade): { regime, atividade: 'servicos'|'comercio', funcionarios, socios_prolabore, notas_mes, filiais,
   *   servicos: [ids], desconto_pct, ajuste, ajuste_motivo, decimo_terceiro? }
   */
  function calcularOrcamento(precosCfg, d) {
    const p = mesclar(precosCfg), o = d || {}, avisos = [];
    const linhas = [];
    const base = +p.base[chaveBase(o.regime, o.atividade)] || 0;
    if (!o.regime) avisos.push('Informe o regime tributário.');
    else if (!base) avisos.push(`A tabela de preços não tem valor para "${chaveBase(o.regime, o.atividade).replace('|', ' — ')}".`);
    linhas.push({ desc: `Honorário base — ${o.regime || 'regime'}${o.atividade && /Simples|Presumido/.test(o.regime || '') ? (o.atividade === 'comercio' ? ' (comércio/indústria)' : ' (serviços)') : ''}`, valor: base });
    const func = Math.max(0, (+o.funcionarios || 0) - (+p.funcionarios_inclusos || 0));
    if (func && p.por_funcionario) linhas.push({ desc: `Folha de pagamento — ${func} funcionário(s) além dos incluídos`, valor: arred(func * p.por_funcionario) });
    if (+o.socios_prolabore && p.por_socio_prolabore) linhas.push({ desc: `Pró-labore — ${+o.socios_prolabore} sócio(s)`, valor: arred(+o.socios_prolabore * p.por_socio_prolabore) });
    const notas = +o.notas_mes || 0;
    const faixa = (p.faixas_notas || []).find(f => f.ate == null || notas <= +f.ate);
    if (notas && faixa && +faixa.valor) linhas.push({ desc: `Volume de documentos — até ${faixa.ate == null ? 'acima da última faixa' : faixa.ate + ' notas/mês'}`, valor: +faixa.valor });
    if (+o.filiais && p.por_filial) linhas.push({ desc: `Filiais — ${+o.filiais}`, valor: arred(+o.filiais * p.por_filial) });
    const escolhidos = (p.servicos || []).filter(s => (o.servicos || []).includes(s.id));
    escolhidos.filter(s => s.cobranca === 'mensal').forEach(s => { linhas.push({ desc: s.nome, valor: +s.valor || 0 }); if (!+s.valor) avisos.push(`Sem preço na tabela: ${s.nome}.`); });
    const subtotal = arred(linhas.reduce((s, l) => s + l.valor, 0));
    const descPct = Math.max(0, +o.desconto_pct || 0);
    if (descPct > (+p.desconto_maximo || 0)) avisos.push(`Desconto de ${descPct}% acima do máximo da tabela (${p.desconto_maximo}%).`);
    const desconto = arred(subtotal * descPct / 100);
    const ajuste = arred(+o.ajuste || 0);
    const mensal = Math.max(0, arred(subtotal - desconto + ajuste));
    const avulsos = escolhidos.filter(s => s.cobranca === 'avulso').map(s => ({ nome: s.nome, valor: +s.valor || 0 }));
    const anuais = escolhidos.filter(s => s.cobranca === 'anual').map(s => ({ nome: s.nome, valor: +s.valor || 0 }));
    const exito = escolhidos.filter(s => s.cobranca === 'exito').map(s => ({ nome: s.nome, percentual: +s.percentual || 0 }));
    [...avulsos, ...anuais].filter(s => !s.valor).forEach(s => avisos.push(`Sem preço na tabela: ${s.nome}.`));
    const decimo = o.decimo_terceiro ?? p.decimo_terceiro;
    return {
      linhas, subtotal, desconto_pct: descPct, desconto, ajuste, ajuste_motivo: o.ajuste_motivo || '', mensal, avulsos, anuais, exito,
      decimo_terceiro: !!decimo, anual: arred(mensal * (decimo ? 13 : 12)), total_avulsos: arred(avulsos.reduce((s, a) => s + a.valor, 0)), avisos,
    };
  }

  // Escopo dos serviços pelo regime e pelo perfil
  function escopo(d) {
    const o = d || {}, r = o.regime, temFolha = (+o.funcionarios || 0) > 0 || (+o.socios_prolabore || 0) > 0;
    const out = [];
    if (r === 'MEI') {
      out.push({ area: 'Fiscal', itens: ['Emissão e controle do DAS-MEI', 'Declaração anual (DASN-SIMEI)', 'Orientação sobre limite de faturamento e emissão de notas'] });
    } else {
      out.push({ area: 'Contábil', itens: ['Escrituração contábil e conciliação das contas', 'Balancetes mensais e Balanço Patrimonial e DRE anuais', ...(r === 'Simples Nacional' ? [] : ['ECD (SPED Contábil) e ECF'])] });
      const fiscal = r === 'Simples Nacional'
        ? ['Apuração mensal do Simples Nacional (PGDAS-D) e guia DAS', 'DEFIS anual', 'Obrigações estaduais e municipais (ISS/ICMS) do enquadramento']
        : r === 'Imune/Isento' ? ['Obrigações acessórias da entidade (ECD, ECF, EFD-Reinf, DCTFWeb)', 'Controle dos requisitos da imunidade/isenção']
          : ['Apuração de IRPJ, CSLL, PIS, COFINS, ISS e/ou ICMS', 'EFD Contribuições, EFD ICMS/IPI quando aplicável, DCTFWeb e EFD-Reinf', 'Emissão das guias de recolhimento'];
      out.push({ area: 'Fiscal', itens: [...fiscal, 'Adequação à Reforma Tributária (IBS/CBS)'] });
    }
    if (temFolha) out.push({ area: 'Pessoal', itens: ['Folha de pagamento, pró-labore, férias e rescisões', 'eSocial, FGTS Digital e DCTFWeb', 'Admissões e demissões (com aviso prévio dos dados)'] });
    out.push({ area: 'Atendimento', itens: ['Portal do cliente com as entregas e guias do mês', 'Atendimento por WhatsApp e e-mail em horário comercial'] });
    return out;
  }

  // ── Proposta ──
  function proposta(op, cfg) {
    const o = op || {}, d = o.dados || {}, e = (cfg && cfg.escritorio) || {}, p = mesclar(cfg && cfg.precos), orc = calcularOrcamento(p, d);
    const hoje = o.data_proposta || new Date().toISOString().slice(0, 10);
    const validade = new Date(new Date(hoje + 'T12:00:00').getTime() + (+p.validade_dias || 15) * 864e5).toISOString().slice(0, 10);
    const br = s => s.split('-').reverse().join('/');
    const b = [];
    b.push({ tipo: 'titulo', partes: ['PROPOSTA DE PRESTAÇÃO DE SERVIÇOS CONTÁBEIS'] });
    b.push({ tipo: 'centro', partes: ['Para ', P(d.nome, 'nome do cliente'), ` · ${br(hoje)} · válida até ${br(validade)}`] });
    b.push({ tipo: 'secao', partes: [`1. Quem somos`] });
    b.push({ tipo: 'paragrafo', partes: [P((cfg && cfg.textos && cfg.textos.apresentacao) || '', 'apresentação do escritório (Tabela de preços → Textos)')] });
    b.push({ tipo: 'secao', partes: ['2. Serviços incluídos'] });
    escopo(d).forEach(g => { b.push({ tipo: 'paragrafo', partes: [g.area] }); g.itens.forEach(i => b.push({ tipo: 'item', partes: [i] })); });
    const extras = (p.servicos || []).filter(s => (d.servicos || []).includes(s.id));
    if (extras.length) { b.push({ tipo: 'paragrafo', partes: ['Serviços adicionais contratados'] }); extras.forEach(s => b.push({ tipo: 'item', partes: [s.nome] })); }
    b.push({ tipo: 'secao', partes: ['3. Investimento'] });
    const linhas = [['Serviço', 'Valor']];
    orc.linhas.filter(l => l.valor).forEach(l => linhas.push([l.desc, brl(l.valor)]));
    if (orc.desconto) linhas.push([`Desconto (${orc.desconto_pct}%)`, '− ' + brl(orc.desconto)]);
    if (orc.ajuste) linhas.push([orc.ajuste_motivo || 'Ajuste', (orc.ajuste < 0 ? '− ' : '') + brl(Math.abs(orc.ajuste))]);
    linhas.push(['Honorário mensal', brl(orc.mensal)]);
    b.push({ tipo: 'tabela', linhas });
    if (orc.decimo_terceiro) b.push({ tipo: 'item', partes: ['Em dezembro é cobrado o 13º honorário (um honorário mensal adicional), pelo fechamento anual e obrigações de fim de ano.'] });
    orc.avulsos.forEach(a => b.push({ tipo: 'item', partes: [`${a.nome}: ${brl(a.valor)} (valor único)`] }));
    orc.anuais.forEach(a => b.push({ tipo: 'item', partes: [`${a.nome}: ${brl(a.valor)} por ano`] }));
    orc.exito.forEach(a => b.push({ tipo: 'item', partes: [`${a.nome}: ${a.percentual}% sobre o valor efetivamente recuperado ou compensado (sem recuperação, sem custo)`] }));
    b.push({ tipo: 'paragrafo', partes: [`Vencimento todo dia ${d.dia_vencimento || 10}. Reajuste anual pelo ${p.indice_reajuste}. Mudanças de regime, de porte ou de volume de documentos podem alterar o honorário, sempre combinado antes.`] });
    b.push({ tipo: 'secao', partes: ['4. Não incluído (cobrado à parte, com orçamento prévio)'] });
    ['Alterações contratuais, certidões e processos em órgãos públicos não listados acima', 'Declarações e retificações de períodos anteriores ao início do contrato', 'Consultorias e pareceres fora da rotina', 'Refazer trabalhos por documentos entregues fora do prazo ou incorretos']
      .forEach(t => b.push({ tipo: 'item', partes: [t] }));
    b.push({ tipo: 'secao', partes: ['5. Próximos passos'] });
    ['Aceite desta proposta (por e-mail ou WhatsApp)', 'Assinatura do contrato de prestação de serviços', 'Envio dos documentos e acessos da lista de implantação', 'Reunião de início e calendário de entrega de documentos']
      .forEach((t, i) => b.push({ tipo: 'item', partes: [`${i + 1}. ${t}`] }));
    b.push({ tipo: 'assinatura', partes: [P(e.nome, 'nome do escritório')], cargo: [e.responsavel, e.crc ? 'CRC ' + e.crc : ''].filter(Boolean).join(' · ') || 'Responsável' });
    return { blocos: b, orcamento: orc, validade };
  }

  // ── Contrato de prestação de serviços contábeis ──
  function contrato(op, cfg) {
    const o = op || {}, d = o.dados || {}, e = (cfg && cfg.escritorio) || {}, p = mesclar(cfg && cfg.precos), orc = calcularOrcamento(p, d);
    const c = o.contrato || {};
    const br = s => (s ? s.split('-').reverse().join('/') : '');
    const b = []; let n = 0;
    const cl = (titulo, ...partes) => { n++; b.push({ tipo: 'secao', partes: [`CLÁUSULA ${n} — ${titulo}`] }); partes.forEach(x => b.push(Array.isArray(x) ? { tipo: 'paragrafo', partes: x } : x)); };
    b.push({ tipo: 'titulo', partes: ['CONTRATO DE PRESTAÇÃO DE SERVIÇOS CONTÁBEIS'] });
    b.push({ tipo: 'paragrafo', partes: ['CONTRATANTE: ', P(d.nome, 'razão social do cliente'), ', inscrita no ', d.documento && d.documento.replace(/\D/g, '').length === 11 ? 'CPF' : 'CNPJ', ' sob o nº ', P(d.documento, 'CNPJ/CPF'),
      ', com sede em ', P(d.endereco, 'endereço do cliente'), ', neste ato representada por ', P(d.representante, 'representante legal'), ', CPF nº ', P(d.representante_cpf, 'CPF do representante'), '.'] });
    b.push({ tipo: 'paragrafo', partes: ['CONTRATADA: ', P(e.nome, 'nome do escritório'), ', inscrita no CNPJ sob o nº ', P(e.cnpj, 'CNPJ do escritório'), ', registro no CRC ', P(e.crc_empresa || e.crc, 'CRC do escritório'),
      ', com sede em ', P(e.endereco, 'endereço do escritório'), ', tendo como responsável técnico ', P(e.responsavel, 'responsável técnico'), ', contador(a), CRC ', P(e.crc, 'CRC do responsável'), '.'] });
    b.push({ tipo: 'paragrafo', partes: ['As partes acima contratam a prestação de serviços contábeis nas condições a seguir.'] });
    cl('DO OBJETO', ['A CONTRATADA prestará à CONTRATANTE, enquadrada no regime ', P(d.regime, 'regime'), ', os serviços abaixo, conforme a proposta comercial de ', br(o.data_proposta) || '___/___/____', ', que integra este contrato:'],
      ...escopo(d).flatMap(g => g.itens.map(i => ({ tipo: 'item', partes: [`${g.area}: ${i}`] }))),
      ...(p.servicos || []).filter(s => (d.servicos || []).includes(s.id)).map(s => ({ tipo: 'item', partes: [`Adicional: ${s.nome}`] })),
      ['Serviços não listados serão orçados à parte e só executados após aprovação da CONTRATANTE.']);
    cl('DAS OBRIGAÇÕES DA CONTRATADA', ['Executar os serviços com zelo, observando as Normas Brasileiras de Contabilidade e a legislação vigente; cumprir os prazos legais das obrigações contratadas, desde que a CONTRATANTE entregue documentos e informações nos prazos deste contrato; manter sigilo sobre as informações recebidas; orientar a CONTRATANTE sobre as obrigações e mudanças relevantes da legislação.']);
    cl('DAS OBRIGAÇÕES DA CONTRATANTE', [`Entregar os documentos e informações do mês até o dia ${c.dia_documentos || p.dia_documentos} do mês seguinte, completos e verdadeiros; informar admissões com antecedência mínima de 2 (dois) dias úteis e demissões, férias e afastamentos assim que definidos; comunicar qualquer fato que altere sua situação fiscal, societária ou trabalhista; manter válidos o certificado digital e as procurações eletrônicas necessárias; pagar os honorários nos vencimentos.`],
      ['A CONTRATANTE é responsável pela veracidade dos documentos e informações fornecidos; multas e encargos decorrentes de documentos entregues fora do prazo, incompletos ou incorretos não são de responsabilidade da CONTRATADA.']);
    cl('DOS HONORÁRIOS', ['Pelos serviços do objeto, a CONTRATANTE pagará o honorário mensal de ', orc.mensal ? brl(orc.mensal) : { falta: 'honorário mensal' }, ', com vencimento no dia ', String(d.dia_vencimento || 10), ' de cada mês, a partir de ', P(br(d.inicio), 'data de início'), '.'],
      ...(orc.decimo_terceiro ? [['Em dezembro será cobrado um honorário adicional (13º), correspondente a uma mensalidade, pelo fechamento anual e obrigações de fim de exercício.']] : []),
      ...orc.avulsos.map(a => ({ tipo: 'item', partes: [`${a.nome}: ${brl(a.valor)}, em parcela única.`] })),
      ...orc.anuais.map(a => ({ tipo: 'item', partes: [`${a.nome}: ${brl(a.valor)} por ano.`] })),
      ...orc.exito.map(a => ({ tipo: 'item', partes: [`${a.nome}: ${a.percentual}% sobre o valor efetivamente recuperado ou compensado.`] })),
      [`O atraso no pagamento sujeita a CONTRATANTE a multa de ${p.multa_atraso}% e juros de ${p.juros_mes}% ao mês, e, após 60 (sessenta) dias, autoriza a CONTRATADA a suspender os serviços mediante aviso por escrito.`]);
    cl('DO REAJUSTE', [`Os honorários serão reajustados a cada 12 (doze) meses pela variação do ${p.indice_reajuste} do período. Mudança de regime tributário, de porte, de número de funcionários ou de volume de documentos permite a revisão do valor, mediante acordo entre as partes.`]);
    cl('DO PRAZO E DA RESCISÃO', ['Este contrato vigora por prazo indeterminado a partir de ', P(br(d.inicio), 'data de início'), `. Qualquer das partes pode rescindi-lo mediante aviso prévio por escrito de ${p.aviso_previo_dias} (${p.aviso_previo_dias === 30 ? 'trinta' : p.aviso_previo_dias}) dias, durante os quais os serviços e honorários continuam devidos.`],
      ['Na rescisão, a CONTRATADA entregará os documentos e arquivos da CONTRATANTE mediante protocolo, com termo de transferência de responsabilidade técnica ao novo profissional, e concluirá as obrigações cujo prazo vencer durante o aviso prévio.']);
    cl('DA PROTEÇÃO DE DADOS', ['As partes tratarão os dados pessoais recebidos apenas para a execução deste contrato e o cumprimento de obrigações legais, com as medidas de segurança adequadas, nos termos da Lei nº 13.709/2018 (LGPD).']);
    cl('DO FORO', ['Fica eleito o foro da comarca de ', P(e.cidade, 'cidade do escritório'), ' para dirimir questões deste contrato.']);
    b.push({ tipo: 'paragrafo', partes: [P(e.cidade, 'cidade'), ', ', P(br(c.assinado_em || d.inicio), 'data'), '.'] });
    b.push({ tipo: 'assinatura', partes: [P(d.nome, 'contratante')], cargo: 'CONTRATANTE' });
    b.push({ tipo: 'assinatura', partes: [P(e.nome, 'contratada')], cargo: `CONTRATADA — ${e.responsavel || 'responsável técnico'}${e.crc ? ', CRC ' + e.crc : ''}` });
    b.push({ tipo: 'assinatura', partes: ['Testemunha 1 — nome e CPF'], cargo: '' });
    b.push({ tipo: 'assinatura', partes: ['Testemunha 2 — nome e CPF'], cargo: '' });
    return { blocos: b, orcamento: orc };
  }

  // ── E-mail de boas-vindas ──
  const MODELO_BOAS_VINDAS = {
    assunto: 'Bem-vindo(a) à {escritorio}, {cliente}!',
    corpo: [
      'Olá, {contato}!',
      '',
      'Seja muito bem-vindo(a) à {escritorio}. A partir de {inicio} cuidamos da contabilidade da {cliente}.',
      '',
      'Como vai funcionar:',
      '• Envie os documentos do mês até o dia {dia_documentos} do mês seguinte (notas, extratos, folha, comprovantes).',
      '• Suas guias e entregas ficam no portal do cliente: {portal}',
      '• O honorário vence todo dia {vencimento}.',
      '• Seu atendimento é com {responsavel}{canal}.',
      '',
      'Para começarmos, precisamos destes itens:',
      '{pendencias}',
      '',
      'Qualquer dúvida, é só chamar. Obrigado pela confiança!',
      '',
      '{responsavel}',
      '{escritorio}',
    ].join('\n'),
  };

  function boasVindas(op, cfg, extras = {}) {
    const o = op || {}, d = o.dados || {}, e = (cfg && cfg.escritorio) || {}, p = mesclar(cfg && cfg.precos);
    const modelo = { ...MODELO_BOAS_VINDAS, ...((cfg && cfg.textos && cfg.textos.boas_vindas) || {}) };
    const pend = checklist(o).filter(g => g.grupo === 'Documentos e acessos do cliente').flatMap(g => g.itens).filter(i => !(o.checklist || {})[i.id]).map(i => '• ' + i.texto);
    const vars = {
      escritorio: e.nome || 'nosso escritório', cliente: d.nome || 'sua empresa', contato: (d.contato || '').split(' ')[0] || 'tudo bem', inicio: d.inicio ? d.inicio.split('-').reverse().join('/') : 'o início do contrato',
      dia_documentos: String((o.contrato && o.contrato.dia_documentos) || p.dia_documentos), portal: extras.portal || '(o link chega em seguida)', vencimento: String(d.dia_vencimento || 10),
      responsavel: d.responsavel || e.responsavel || 'nossa equipe', whatsapp_escritorio: e.whatsapp || '',
      canal: e.whatsapp ? `, pelo WhatsApp ${e.whatsapp} ou por este e-mail` : ', por este e-mail', pendencias: pend.length ? pend.join('\n') : '• Nada pendente: já recebemos tudo.',
    };
    const troca = t => t.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
    return { para: d.email || '', assunto: troca(modelo.assunto), corpo: troca(modelo.corpo) };
  }

  // ── Checklist de implantação, com o link da ferramenta do portal de cada item ──
  function checklist(op) {
    const o = op || {}, d = o.dados || {}, r = d.regime || '';
    const temFolha = (+d.funcionarios || 0) > 0 || (+d.socios_prolabore || 0) > 0;
    const veio = d.origem_contabil === 'outro_contador';
    const nova = d.societario === 'abertura';
    const comercio = d.atividade === 'comercio';
    const G = (grupo, itens) => ({ grupo, itens: itens.filter(Boolean) });
    const it = (id, texto, link, auto) => ({ id, texto, link: link || null, auto: auto || null });
    return [
      G('Comercial', [
        it('proposta_aceita', 'Proposta aceita pelo cliente', null, 'proposta'),
        it('contrato_assinado', 'Contrato de prestação de serviços assinado pelas duas partes (com testemunhas)', null, 'contrato'),
      ]),
      G('Cadastro no portal', [
        it('cad_gestao', 'Cliente no Gestão Fiscal com regime, honorário e dia de vencimento (alimenta o Financeiro JCR)', 'gclik.html', 'cliente'),
        it('cad_entregas', 'Cliente no JCR Entregas com as obrigações do regime e os responsáveis', 'entregas/', 'entregas'),
        it('cad_portal', 'Portal do cliente ativado e link enviado', 'entregas/', 'portal'),
        d.societario && d.societario !== 'nao' ? it('cad_societario', `Processo de ${d.societario === 'abertura' ? 'abertura' : d.societario === 'transformacao' ? 'transformação' : 'alteração'} aberto no Painel Societário`, 'societario/', 'societario') : null,
      ]),
      veio ? G('Transferência do contador anterior', [
        it('trans_comunicado', 'Comunicado ao contador anterior (pelo cliente) com a data de troca'),
        it('trans_documentos', 'Receber do contador anterior: balancete/balanço de encerramento, livros e arquivos ECD/ECF, folha e senhas, com protocolo'),
        it('trans_termo', 'Termo de transferência de responsabilidade técnica assinado'),
        it('trans_pendencias', 'Conferir obrigações do último mês do anterior (quem entrega o quê)'),
      ]) : null,
      G('Documentos e acessos do cliente', [
        nova ? null : it('doc_contrato_social', 'Contrato social e últimas alterações (ou requerimento de empresário/CCMEI)'),
        nova ? null : it('doc_cnpj', 'Cartão CNPJ, inscrição municipal e estadual (se houver)'),
        it('doc_certificado', 'Certificado digital A1 da empresa (arquivo e senha) e validade anotada'),
        it('doc_procuracao', 'Procuração eletrônica no e-CAC para o escritório'),
        r === 'Simples Nacional' || r === 'MEI' ? it('doc_simples', 'Código de acesso do Simples Nacional / acesso gov.br') : null,
        it('doc_prefeitura', 'Acesso à prefeitura (ISS e nota fiscal de serviço)'),
        comercio ? it('doc_sefaz', 'Acesso SEFAZ-SP (Posto Fiscal Eletrônico) e inscrição estadual') : null,
        temFolha ? it('doc_folha', 'Dados dos funcionários e sócios (cadastro, salários, férias) e procuração no eSocial/FGTS Digital') : null,
        it('doc_bancos', 'Bancos e extratos (OFX) das contas da empresa'),
        nova ? null : it('doc_declaracoes', r === 'Simples Nacional' ? 'Últimas PGDAS-D e DEFIS' : r === 'MEI' ? 'Últimas DASN-SIMEI' : 'Últimas ECD, ECF, DCTFWeb e EFD'),
      ]),
      nova ? null : G('Diagnóstico inicial', [
        it('diag_certidoes', 'Certidões negativas: Receita/PGFN, estadual, municipal, FGTS e trabalhista'),
        it('diag_ecac', 'Situação fiscal no e-CAC (pendências, parcelamentos, malhas)'),
        it('diag_oportunidades', 'Oportunidades de recuperação tributária', 'hub/recuperacao_tributaria.html'),
        r && r !== 'MEI' ? it('diag_reforma', 'Simulação da Reforma Tributária para o cliente', 'reforma/') : null,
      ]),
      G('Boas-vindas e início', [
        it('bv_email', 'E-mail de boas-vindas enviado', null, 'email'),
        it('bv_whatsapp', 'Grupo de WhatsApp criado com o cliente'),
        it('bv_reuniao', 'Reunião de início feita (calendário de documentos, dúvidas, responsáveis)'),
        it('bv_primeiro_mes', 'Primeiro mês fechado e entregue sem pendência'),
      ]),
    ].filter(Boolean);
  }

  function progresso(op) {
    const itens = checklist(op).flatMap(g => g.itens), feitos = itens.filter(i => (op.checklist || {})[i.id]).length;
    return { feitos, total: itens.length, pct: itens.length ? Math.round(feitos / itens.length * 100) : 0 };
  }

  // Campos que faltam para avançar de etapa
  function faltando(op, etapa) {
    const d = (op && op.dados) || {}, f = [];
    const exige = (cond, msg) => { if (!cond) f.push(msg); };
    if (['orcamento', 'proposta', 'contrato', 'implantacao'].includes(etapa)) { exige(d.nome, 'nome do cliente'); exige(d.regime, 'regime'); exige(d.email || d.whatsapp, 'e-mail ou WhatsApp'); }
    if (['contrato', 'implantacao'].includes(etapa)) { exige(d.documento || d.societario === 'abertura', 'CNPJ/CPF'); exige(d.inicio, 'data de início'); }
    if (etapa === 'implantacao') { exige(d.representante, 'representante legal'); exige((op.contrato || {}).assinado_em, 'data de assinatura do contrato'); }
    return f;
  }

  // Dados do cliente para o Gestão Fiscal (gclik_clientes)
  function clienteGestao(op, escritorioId) {
    const d = (op && op.dados) || {}, orc = (op && op.orcamento) || {};
    return {
      razao_social: d.nome, nome_fantasia: d.fantasia || null, cnpj: d.documento || null, regime: d.regime === 'Imune/Isento' ? 'Lucro Presumido' : d.regime,
      status: 'Ativo', responsavel: d.responsavel || null, email: d.email || null, telefone: d.whatsapp || d.telefone || null,
      cidade: d.cidade || null, estado: d.uf || 'SP', tipo_empresa: d.atividade === 'comercio' ? 'Comércio' : 'Serviço',
      honor_mensal: orc.mensal || null, dia_vencimento: +d.dia_vencimento || 10, escritorio_id: escritorioId || null,
      observacoes: `Cliente desde ${d.inicio ? d.inicio.split('-').reverse().join('/') : '—'} (onboarding no portal).`,
    };
  }

  const api = { ETAPAS, REGIMES, PRECOS_PADRAO, MODELO_BOAS_VINDAS, mesclar, chaveBase, calcularOrcamento, escopo, proposta, contrato, boasVindas, checklist, progresso, faltando, clienteGestao, brl };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Onboarding = api;
})(typeof window !== 'undefined' ? window : globalThis);
