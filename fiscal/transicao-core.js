/*
 * Transição de regime de apuração (MEI, Simples Nacional, Lucro Presumido, Lucro Real): lista de tarefas
 * por origem, destino, motivo e perfil do cliente. Funções puras, testadas em tests/transicao.test.js.
 * Cada item tem um id estável (o andamento fica salvo por id). "Confira" = regra que muda com frequência.
 * Base: LC 123/2006 (Simples/MEI), Lei 9.718/1998 e RIR/2018 (Presumido/Real), IN RFB 1.700/2017.
 */
(function (root) {
  const REGIMES = ['MEI', 'Simples Nacional', 'Lucro Presumido', 'Lucro Real'];
  const MOTIVOS = {
    opcao: 'Opção (planejamento tributário)',
    excesso: 'Excesso de receita / limite',
    obrigatorio: 'Obrigatoriedade (atividade, sócio, filial, receita)',
    debito: 'Exclusão por débitos (de ofício)',
  };
  const LINK = {
    simples: { nome: 'Portal do Simples Nacional', url: 'https://www8.receita.fazenda.gov.br/SimplesNacional/' },
    societario: { nome: 'Painel Societário', url: 'societario/' },
    reforma: { nome: 'Simulador da Reforma', url: 'reforma/' },
    gestao: { nome: 'Gestão Fiscal', url: 'gclik.html' },
    entregas: { nome: 'JCR Entregas', url: 'entregas/' },
    ecac: { nome: 'e-CAC', url: 'https://cav.receita.fazenda.gov.br/' },
    cadesp: { nome: 'SEFAZ-SP (CADESP)', url: 'https://www.cadesp.fazenda.sp.gov.br/' },
  };
  const it = (id, texto, extra = {}) => ({ id, texto, ...extra });

  // ── 1. Decisão e prazos (depende de origem, destino e motivo) ──
  function decisao(o, d, motivo) {
    const out = [];
    out.push(it('dec_simulacao', 'Simular a carga nos dois regimes (impostos, folha e obrigações) e registrar a decisão com o cliente.', { link: LINK.reforma }));
    if (o === 'MEI') {
      out.push(it('dec_mei_comunicar', 'Comunicar o desenquadramento do SIMEI no Portal do Simples Nacional até o último dia útil do mês seguinte ao fato (excesso de receita, sócio, 2º empregado, atividade não permitida, filial).', { link: LINK.simples, prazo: true }));
      if (motivo === 'excesso') out.push(it('dec_mei_excesso', 'Excesso de receita: até 20% acima do limite anual do MEI (R$ 81 mil, proporcional no ano de abertura) o desenquadramento vale a partir de 1º de janeiro do ano seguinte e o excesso é recolhido como ME; acima de 20% vale retroativo a 1º de janeiro do ano (ou desde a abertura). Confira o limite vigente.', { prazo: true }));
    }
    if (o === 'Simples Nacional' && d !== 'MEI') {
      if (motivo === 'opcao') out.push(it('dec_sn_exclusao_opcao', 'Exclusão por opção no Portal do Simples: feita em janeiro, vale desde 1º de janeiro do mesmo ano; feita em outro mês, vale a partir de 1º de janeiro do ano seguinte.', { link: LINK.simples, prazo: true }));
      if (motivo === 'excesso') out.push(it('dec_sn_exclusao_excesso', 'Receita acumulada no ano acima de R$ 4,8 milhões: excesso de até 20% (até R$ 5,76 milhões) exclui a partir de 1º de janeiro do ano seguinte; acima de 20%, a partir do mês seguinte ao do excesso. Comunicar a exclusão no Portal do Simples até o último dia útil do mês seguinte.', { link: LINK.simples, prazo: true }));
      if (motivo === 'obrigatorio') out.push(it('dec_sn_exclusao_vedacao', 'Vedação (atividade, sócio PJ, participação em outra empresa, filial no exterior etc.): comunicar a exclusão no Portal do Simples até o último dia útil do mês seguinte ao fato; vale a partir do mês seguinte ao da vedação.', { link: LINK.simples, prazo: true }));
      if (motivo === 'debito') out.push(it('dec_sn_exclusao_debito', 'Exclusão de ofício por débitos: o Termo de Exclusão chega pelo DTE-SN. Regularizar (pagar ou parcelar) em até 30 dias da ciência torna a exclusão sem efeito; sem isso, a exclusão vale a partir de 1º de janeiro do ano seguinte. Confira o termo.', { link: LINK.simples, prazo: true }));
    }
    if (d === 'Simples Nacional' && o !== 'MEI') out.push(it('dec_sn_opcao', 'Opção pelo Simples só em janeiro, até o último dia útil, no Portal do Simples (empresa nova: até 30 dias da última inscrição, dentro de 180 dias da abertura). Vale desde 1º de janeiro.', { link: LINK.simples, prazo: true }));
    if (d === 'MEI') out.push(it('dec_mei_opcao', 'Opção pelo SIMEI em janeiro, no Portal do Simples (vale desde 1º de janeiro). Requisitos: empresário individual, receita do ano anterior dentro do limite do MEI, atividade permitida, no máximo 1 empregado, sem sócio e sem filial.', { link: LINK.simples, prazo: true }));
    if (d === 'Lucro Presumido') out.push(it('dec_lp_opcao', 'Opção pelo Lucro Presumido = pagamento da primeira quota do IRPJ do 1º trimestre (código 2089), no último dia útil de abril, ou do 1º período de apuração do ano. É irretratável para o ano todo.', { prazo: true }));
    if (d === 'Lucro Real') out.push(it('dec_lr_opcao', 'Opção pelo Lucro Real = pagamento do primeiro imposto do ano: estimativa mensal de janeiro (vence no fim de fevereiro) ou IRPJ do 1º trimestre. Definir antes: trimestral ou anual por estimativa (com balancetes de suspensão/redução).', { prazo: true }));
    if (o === 'Lucro Real' && d === 'Lucro Presumido') out.push(it('dec_lr_lp_requisito', 'Confirmar que a empresa pode sair do Real: receita do ano anterior até R$ 78 milhões e nenhuma obrigatoriedade (instituição financeira, lucro no exterior, benefício fiscal de isenção/redução, factoring etc.).'));
    if (d === 'Lucro Real' && motivo === 'obrigatorio') out.push(it('dec_lr_obrigatorio', 'Obrigatoriedade do Lucro Real confirmada (receita do ano anterior acima de R$ 78 milhões ou atividade obrigada, Lei 9.718/1998, art. 14).'));
    return out;
  }

  // ── 2. Encerrar o regime de origem ──
  function encerrar(o, d, perfil) {
    const out = [];
    if (o === 'MEI') {
      out.push(it('enc_mei_das', 'Pagar os DAS-MEI até o mês anterior ao desenquadramento (e o complemento como ME, se houve excesso).'));
      out.push(it('enc_mei_dasn', 'DASN-SIMEI do período em que foi MEI (confira no portal se cabe a declaração de situação especial).', { link: LINK.simples }));
      out.push(it('enc_mei_societario', 'Se entrar sócio ou virar LTDA: transformação na Junta (EI/MEI → LTDA) no Painel Societário. Sem sócio, continua empresário individual (ME).', { link: LINK.societario }));
    }
    if (o === 'Simples Nacional') {
      out.push(it('enc_sn_pgdas', 'Último PGDAS-D e DAS dos meses ainda no Simples; conferir parcelamentos do Simples em andamento.', { link: LINK.simples }));
      out.push(it('enc_sn_defis', 'DEFIS do período no Simples, no prazo normal (31 de março do ano seguinte).'));
      if (perfil.comercio) out.push(it('enc_sn_estoque', 'Inventário do estoque na data da exclusão (base para crédito de ICMS que a legislação estadual permitir — confira no RICMS-SP).'));
      if (d === 'MEI') out.push(it('enc_sn_ltda_ei', 'MEI só pode ser empresário individual: se a empresa é LTDA, transformar em EI na Junta antes da opção.', { link: LINK.societario }));
    }
    if (o === 'Lucro Presumido') {
      out.push(it('enc_lp_ultimo', 'Fechar o último período no Presumido: IRPJ/CSLL trimestrais, PIS/COFINS cumulativos, EFD-Contribuições até o mês anterior e ECF do ano.'));
      if (d === 'Simples Nacional') out.push(it('enc_lp_debitos', 'Zerar pendências antes de janeiro: débitos na Receita, PGFN, estado e município impedem a opção (CND/positiva com efeito de negativa).', { link: LINK.ecac }));
      if (d === 'Lucro Real') out.push(it('enc_lp_balanco', 'Balanço de abertura do primeiro dia do Lucro Real: estoques, imobilizado e saldos conciliados (base de custo e depreciação).'));
    }
    if (o === 'Lucro Real') {
      out.push(it('enc_lr_ultimo', 'Fechar o último período no Real: IRPJ/CSLL, PIS/COFINS não cumulativos, EFD-Contribuições, ECD e ECF com e-Lalur/e-Lacs.'));
      out.push(it('enc_lr_prejuizo', 'Prejuízo fiscal e base negativa da CSLL ficam guardados na parte B do e-Lalur: não são compensados fora do Real (só se a empresa voltar a ele).'));
      out.push(it('enc_lr_diferidos', 'Valores com tributação diferida controlados na parte B do e-Lalur devem ser adicionados à base no primeiro período fora do Real (confira IN RFB 1.700/2017).'));
      out.push(it('enc_lr_creditos', 'Créditos acumulados de PIS/COFINS não cumulativos: pedir ressarcimento ou compensar o que for possível antes da mudança (PER/DCOMP).', { link: LINK.ecac }));
      if (d === 'Simples Nacional') out.push(it('enc_lr_debitos', 'Zerar pendências antes de janeiro: débitos na Receita, PGFN, estado e município impedem a opção.', { link: LINK.ecac }));
    }
    return out;
  }

  // ── 3. Entrar no novo regime ──
  function entrar(o, d, perfil) {
    const out = [];
    if (d === 'MEI') {
      out.push(it('ent_mei_das', 'DAS-MEI mensal (valor fixo) e DASN-SIMEI anual; acompanhar o limite de receita mês a mês.'));
    }
    if (d === 'Simples Nacional') {
      out.push(it('ent_sn_anexo', 'Enquadrar cada atividade no anexo certo e calcular o Fator R (folha de 12 meses ÷ receita de 12 meses ≥ 28% → Anexo III em vez do V).'));
      out.push(it('ent_sn_sublimite', 'Sublimite de R$ 3,6 milhões: acima dele ICMS e ISS saem do DAS e são apurados à parte.'));
      out.push(it('ent_sn_pgdas', 'PGDAS-D mensal até o dia 20 e DEFIS anual; cadastrar no JCR Entregas.', { link: LINK.entregas }));
      out.push(it('ent_sn_ibs', 'Reforma Tributária: decidir se o IBS/CBS fica dentro do DAS ou é recolhido por fora (opção semestral a partir de 2027 — confira o prazo).', { link: LINK.reforma }));
      if (o === 'MEI') out.push(it('ent_sn_mei_folha', 'Ex-MEI: CPP (INSS patronal) passa a seguir o anexo — no Anexo IV é recolhida fora do DAS.'));
    }
    if (d === 'Lucro Presumido') {
      out.push(it('ent_lp_presuncao', 'Percentuais de presunção por atividade: IRPJ 8% (comércio/indústria), 16% (transporte de passageiros e outras), 32% (serviços); CSLL 12% ou 32%. Adicional de 10% do IRPJ sobre a base acima de R$ 60 mil por trimestre.'));
      out.push(it('ent_lp_lc224', 'Conferir o acréscimo de 10% nos percentuais de presunção sobre a receita acima de R$ 5 milhões no ano (LC 224/2025, a partir de 2026).'));
      out.push(it('ent_lp_piscofins', 'PIS 0,65% e COFINS 3% cumulativos, sem créditos. Escolher regime de caixa ou competência para o ano.'));
      out.push(it('ent_lp_obrigacoes', 'Obrigações novas: DCTFWeb, EFD-Reinf, EFD-Contribuições, ECF anual e ECD (necessária para distribuir lucro acima da presunção).', { link: LINK.entregas }));
      out.push(it('ent_lp_dividendos', 'Distribuição de lucros: isenta até a base presumida (menos os impostos) sem ECD; acima disso, só com escrituração. Conferir a retenção de IR sobre dividendos acima de R$ 50 mil por mês por sócio (Lei 15.270/2025, a partir de 2026).'));
    }
    if (d === 'Lucro Real') {
      out.push(it('ent_lr_forma', 'Apuração trimestral ou anual por estimativa mensal (balancetes de suspensão/redução para pagar menos).'));
      out.push(it('ent_lr_piscofins', 'PIS 1,65% e COFINS 7,6% não cumulativos: mapear os créditos (insumos, energia, aluguel de PJ, depreciação, fretes).'));
      out.push(it('ent_lr_lalur', 'e-Lalur/e-Lacs na ECF: adições, exclusões e compensação de prejuízo limitada a 30% do lucro do período.'));
      out.push(it('ent_lr_contabil', 'Contabilidade completa e mensal (conciliações, provisões, inventário e custo) e ECD obrigatória.'));
      out.push(it('ent_lr_obrigacoes', 'Obrigações: DCTFWeb, EFD-Reinf, EFD-Contribuições (com créditos), ECD e ECF.', { link: LINK.entregas }));
    }
    if ((d === 'Lucro Presumido' || d === 'Lucro Real') && perfil.comercio) {
      out.push(it('ent_icms_rpa', 'ICMS no regime periódico (RPA) da SEFAZ-SP: escrituração e EFD ICMS/IPI, créditos de entrada e ICMS-ST conforme o produto.', { link: LINK.cadesp }));
    }
    if ((d === 'Lucro Presumido' || d === 'Lucro Real') && (o === 'Simples Nacional' || o === 'MEI') && perfil.folha) {
      out.push(it('ent_folha_inss', 'Folha: INSS patronal de 20% + RAT/FAP + terceiros passa a ser pago fora do DAS (aumento de custo): avisar o cliente e ajustar o eSocial/DCTFWeb.'));
    }
    return out;
  }

  // ── 4. Cadastros e sistemas (todas as transições) ──
  function sistemas(o, d) {
    return [
      it('sis_emissor', `Emissor de notas do cliente: regime tributário (CRT) e ${d === 'Simples Nacional' || d === 'MEI' ? 'CSOSN' : 'CST'} de ICMS, PIS e COFINS; alíquota do ISS na NFS-e.`),
      it('sis_contabil', 'Sistema contábil/fiscal (Domínio ou outro): parametrizar o novo regime a partir da data de efeito.'),
      it('sis_portal', 'Portal: atualizar o regime no Gestão Fiscal e as obrigações no JCR Entregas (botão ao lado).', { link: LINK.gestao, auto: 'portal' }),
      it('sis_prefeitura', 'Prefeitura: conferir o enquadramento do ISS (fixo, Simples ou alíquota sobre o faturamento) no cadastro mobiliário.'),
    ];
  }

  // ── 5. Cliente ──
  function cliente() {
    return [
      it('cli_comunicar', 'Explicar ao cliente o que muda: impostos, datas das guias, custo da folha e documentos que ele passa a mandar.'),
      it('cli_honorario', 'Revisar o honorário (a mudança de regime muda o escopo do trabalho).'),
      it('cli_primeiro_mes', 'Primeira apuração no novo regime conferida e entregue sem pendência.'),
    ];
  }

  function gerar({ origem, destino, motivo = 'opcao', comercio = false, folha = false } = {}) {
    if (!REGIMES.includes(origem) || !REGIMES.includes(destino) || origem === destino) return [];
    const perfil = { comercio: !!comercio, folha: !!folha };
    return [
      { grupo: 'Decisão e prazos', itens: decisao(origem, destino, motivo) },
      { grupo: `Encerrar o ${origem}`, itens: encerrar(origem, destino, perfil) },
      { grupo: `Entrar no ${destino}`, itens: entrar(origem, destino, perfil) },
      { grupo: 'Cadastros e sistemas', itens: sistemas(origem, destino) },
      { grupo: 'Cliente', itens: cliente() },
    ].filter(g => g.itens.length);
  }

  function progresso(lista, feitos) {
    const ids = lista.flatMap(g => g.itens.map(i => i.id)), ok = ids.filter(id => (feitos || {})[id]).length;
    return { feitos: ok, total: ids.length, pct: ids.length ? Math.round(ok / ids.length * 100) : 0 };
  }

  // Motivos que fazem sentido para cada par (para a tela)
  function motivosPara(origem, destino) {
    if (destino === 'MEI') return ['opcao'];
    if (origem === 'Simples Nacional' || origem === 'MEI') return ['opcao', 'excesso', 'obrigatorio', ...(origem === 'Simples Nacional' ? ['debito'] : [])];
    if (destino === 'Lucro Real') return ['opcao', 'obrigatorio'];
    return ['opcao'];
  }

  const api = { REGIMES, MOTIVOS, gerar, progresso, motivosPara };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Transicao = api;
})(typeof window !== 'undefined' ? window : globalThis);
