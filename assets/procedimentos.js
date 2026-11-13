/*
 * Procedimentos (POPs) dos processos do Portal JCR.
 *
 * A chave é "departamento/processo", com os ids de assets/departamentos.js.
 * Quando um processo tem procedimento aqui, o portal mostra "Procedimento"
 * em vez de "A documentar".
 *
 * Campos (todos opcionais, exceto passos):
 *   objetivo, responsavel, prazo, entradas: [], passos: [], checklist: [],
 *   ferramentas: [{ nome, url }], manuais: [{ nome, url }], atencao: [], atualizado: 'AAAA-MM-DD'
 *
 * Exemplo (remova as barras // para usar):
 *
 * 'fiscal/apuracao-simples': {
 *   objetivo: 'Apurar e transmitir o Simples Nacional do mês e enviar a guia ao cliente.',
 *   responsavel: 'Analista fiscal',
 *   prazo: 'Até o dia 15 do mês seguinte (vencimento dia 20)',
 *   entradas: ['XMLs de saída do mês', 'Faturamento de serviços', 'Folha (Fator R)'],
 *   passos: ['Importar as notas', 'Conferir faturamento x notas', 'Calcular no PGDAS-D', 'Transmitir e gerar DAS', 'Enviar guia ao cliente'],
 *   checklist: ['Faturamento conferido', 'Anexo e Fator R corretos', 'Guia enviada'],
 *   ferramentas: [{ nome: 'Gestão Fiscal', url: 'gclik.html' }],
 *   atencao: ['Sublimite estadual', 'Receitas com ST ou monofásicas'],
 *   atualizado: '2026-10-08',
 * },
 */

window.JCR_PROCEDIMENTOS = (function () {
  // ── Societário e Legalização (SP: Facilita SP + Manuais de Registro do DREI, IN 81/2020) ──
  // Manuais completos na pasta do Drive: _JCR Soluções Tributárias/_Empresas/Legalização/_Manuais
  const DRIVE = id => 'https://drive.google.com/file/d/' + id + '/view';
  const MANUAIS_SOC = {
    rapido: { nome: 'Facilita SP — Fluxo Rápido', url: DRIVE('1X0UsCLdJ-WH_2rbKv-q1U_TzL2q6czwP') },
    tradicional: { nome: 'Facilita SP — Fluxo Tradicional', url: DRIVE('1fRV0t8rDxph_NzTAY2ouyOYvIf7Qg8vc') },
    baixa: { nome: 'Facilita SP — Baixa de Pessoa Jurídica', url: DRIVE('1NsNKgQseF2li3e6-hQTG09fpacQFoEGS') },
    mat: { nome: 'Módulo de Administração Tributária (MAT)', url: DRIVE('1McnyrI9ni_odt2-qoOl66ai6XGKIQIGE') },
    vre: { nome: 'Manual de Preenchimento VRE', url: DRIVE('1cjV_KagRWtdjrUBZrRqWeXzQCwDm65pK') },
    ltda: { nome: 'DREI — Anexo IV: Sociedade Limitada', url: DRIVE('1IUqelI-GsseYLsbHrotTinOehcyQ2DLg') },
    ei: { nome: 'DREI — Anexo II: Empresário Individual', url: DRIVE('1VWaQaZ8KyHYBVa6gQ3Z6Xpiu27xP-cwW') },
    sa: { nome: 'DREI — Anexo V: Sociedade Anônima', url: DRIVE('1EemFFqE9FNbMoKcUKAKD3l-GuCdZDe6_') },
    coop: { nome: 'DREI — Anexo VI: Cooperativa', url: DRIVE('1f6xp7RivIWqi2EnNNUjK4SHWECQmY1Po') },
    certidao: { nome: 'Certidão de inteiro teor', url: DRIVE('1mKsCGSCioYl1DwruoHaHGqZXjN_RZimi') },
    correcao: { nome: 'Correção de dados cadastrais', url: DRIVE('1hNkPIATzCnyHB21Bl_QrnFTTH4lPvfRU') },
  };
  const PAINEL_SOC = { nome: 'Painel Societário', url: 'societario/' };
  const FACILITA_SP = { nome: 'Facilita SP', url: 'https://portalfacilitasp.sp.gov.br/facilitasp' };
  const REDESIM = { nome: 'REDESIM (Coletor Nacional / DBE)', url: 'https://www.gov.br/empresas-e-negocios/pt-br/redesim' };
  const ATENCAO_JUCESP = [
    'Exigência ou vício: 30 dias para corrigir sem nova taxa. Depois disso o pedido é suspenso (ou a empresa pode ser baixada, na abertura) e é preciso pagar de novo.',
    'Deferimento automático não é o fim: a JUCESP faz o exame posterior (análise de vício, até 2 dias úteis). Só conclua depois dele.',
    'Todos que assinam (sócios, contador, testemunhas) precisam de gov.br nível Ouro. Confira antes de começar.',
    'Correção de vício: na etapa "Gerenciamento de Impressão", escolha "Saneamento de Vício" para não pagar nova DARE.',
  ];

  return {
    'societario/abertura': {
      objetivo: 'Registrar a empresa na JUCESP pelo Facilita SP e deixá-la pronta para operar: CNPJ, tributação, inscrições estadual e municipal, licenças e cadastro no escritório.',
      responsavel: 'Societário (hoje: freelance, acompanhado pelo Painel Societário)',
      prazo: 'Fluxo rápido: deferimento automático após a DARE compensar. Tradicional: depende da análise da JUCESP.',
      entradas: [
        'RG e CPF de cada sócio/titular e do administrador',
        'Comprovante de residência atualizado de cada sócio',
        'Certidão de casamento ou união estável, quando o estado civil influir no registro',
        'IPTU (ou INCRA) do endereço da empresa e área do imóvel',
        'Matrícula, IPTU ou INCRA do imóvel, se o capital for integralizado com imóvel',
        'Atividades (CNAEs), capital social e divisão das quotas',
        'Nome empresarial pretendido e nome fantasia',
        'gov.br nível Ouro de todos os sócios',
      ],
      passos: [
        'Abrir o processo no Painel Societário e mandar ao cliente a lista de documentos ("Copiar lista").',
        'Definir o fluxo. Rápido: só EI ou LTDA, matriz, sócios pessoas físicas brasileiras, maiores e residentes no Brasil, contrato padrão do DREI e sem procurador. Fora disso: tradicional.',
        'No Facilita SP, "Abertura de Pessoa Jurídica": responder o questionário de definição de fluxo, escolher município, natureza jurídica e enquadramento (ME, EPP ou Demais).',
        'Simulador de grau de risco: informar os CNAEs, se terá estabelecimento próprio, e responder as questões das atividades "Pendente de resposta".',
        'Etapa 1: integrantes e nome empresarial (consultar colidência do nome).',
        'Etapa 2: dados do estabelecimento (IPTU/INCRA, endereço, áreas, capital) e consulta de viabilidade na prefeitura (retorno em até 3 minutos nos municípios conveniados).',
        'Somente fluxo tradicional: preencher o DBE no Coletor Nacional da Receita e confirmar a liberação no Facilita SP.',
        'Contador (obrigatório se a atividade exigir inscrição estadual) e advogado (obrigatório para porte "Demais").',
        'Dados complementares de cada sócio: capital, quotas e dados pessoais. Enviar para validação na Receita.',
        'Testemunhas (opcional) e revisão da prévia do contrato social.',
        'Assinaturas: cada um entra no Facilita SP com o próprio gov.br, em "Minhas assinaturas".',
        'Pagar a DARE (PIX ou boleto, que compensa em até 3 dias úteis) e acompanhar o protocolo até "Concluído".',
        'Emitir a certidão de inteiro teor; escolher a forma de tributação no MAT para liberar o cartão CNPJ.',
        'Inscrição municipal ("Solicite sua Inscrição Municipal"), inscrição estadual se houver ICMS e licenciamento (CLI ou alvará na prefeitura).',
        'Esperar a análise de vício, providenciar o certificado digital e cadastrar o cliente no Gestão Fiscal e no JCR Entregas.',
      ],
      checklist: [
        'Nome sem colidência e viabilidade aprovada',
        'Contrato conferido com os documentos (nomes, CPFs, capital, quotas, endereço)',
        'Opção pelo Simples Nacional feita no prazo, quando for o caso',
        'Análise de vício sem pendência',
        'Inscrições e licenças emitidas',
        'Cliente no Gestão Fiscal e no JCR Entregas com regime e obrigações',
      ],
      ferramentas: [PAINEL_SOC, FACILITA_SP, REDESIM, { nome: 'JCR Entregas', url: 'entregas/' }, { nome: 'Gestão Fiscal', url: 'gclik.html' }],
      manuais: [MANUAIS_SOC.rapido, MANUAIS_SOC.tradicional, MANUAIS_SOC.mat, MANUAIS_SOC.ltda, MANUAIS_SOC.ei, MANUAIS_SOC.certidao],
      atencao: [
        'No fluxo rápido não existe representação por terceiros: o preenchimento é feito pelos próprios integrantes. Se o escritório for preencher, use o fluxo tradicional.',
        'Status "Não dispensado do licenciamento" não impede o protocolo, mas a empresa vai precisar de vistoria/licença antes de funcionar.',
        'Município não conveniado: a viabilidade é dispensada no sistema e a regularização é feita direto na prefeitura.',
        ...ATENCAO_JUCESP,
      ],
      atualizado: '2026-11-12',
    },
    'societario/alteracao-contratual': {
      objetivo: 'Registrar na JUCESP uma mudança no contrato social (nome, endereço, atividade, capital, sócios ou administrador) e atualizar os demais órgãos e o cadastro do escritório.',
      responsavel: 'Societário',
      prazo: 'Registrar em até 30 dias da assinatura para valer desde a data do ato.',
      entradas: [
        'O que vai mudar, por escrito e aprovado pelo cliente',
        'RG, CPF e comprovante de residência de quem entra',
        'IPTU (ou INCRA) do novo endereço, se mudar de endereço',
        'Declaração de desimpedimento do novo administrador, se não estiver em cláusula do contrato',
        'Certidão de casamento/divórcio, se o nome civil de um sócio mudou',
      ],
      passos: [
        'Abrir o processo no Painel Societário, descrever as mudanças e mandar a lista de documentos ao cliente.',
        'No Facilita SP, "Alteração de Pessoa Jurídica". Mudança de nome, atividade ou endereço passa pela viabilidade.',
        'DBE de alteração no Coletor Nacional quando mudar nome, objeto, endereço, capital ou quadro de sócios e administradores.',
        'Redigir a alteração contratual: título com número da alteração, preâmbulo com os sócios e a empresa (nome, CNPJ, endereço), nova redação das cláusulas e, de preferência, o contrato consolidado.',
        'Assinaturas. ME/EPP: basta assinatura de sócios com mais da metade do capital, sem ata. Demais: todos assinam ou se faz reunião/assembleia com ata.',
        'Pagar a DARE, acompanhar o protocolo e aguardar o deferimento e a análise de vício.',
        'Conferir se SEFAZ e prefeitura foram atualizadas pela integração; se não, atualizar. Mudança de endereço ou atividade: rever licenças e alvará.',
        'Atualizar o cadastro do cliente no Gestão Fiscal e no JCR Entregas (regime, endereço, atividades).',
      ],
      checklist: [
        'Cláusulas alteradas batem com o pedido do cliente',
        'Quórum de assinatura atendido',
        'Inscrições e licenças atualizadas',
        'Cadastro interno atualizado',
      ],
      ferramentas: [PAINEL_SOC, FACILITA_SP, REDESIM],
      manuais: [MANUAIS_SOC.tradicional, MANUAIS_SOC.ltda, MANUAIS_SOC.ei, MANUAIS_SOC.correcao],
      atencao: [
        'Novo administrador: anexar identidade e declaração de desimpedimento.',
        'Redução de capital, exclusão de sócio e falecimento de sócio têm regras próprias no Manual da LTDA (Seção II e IV).',
        ...ATENCAO_JUCESP,
      ],
      atualizado: '2026-11-12',
    },
    'societario/transformacao': {
      objetivo: 'Mudar o tipo jurídico sem fechar a empresa (empresário individual ↔ LTDA, MEI que virou ME/EPP), mantendo CNPJ e histórico.',
      responsavel: 'Societário',
      prazo: 'Sob demanda; MEI que estourou o limite deve comunicar o desenquadramento no prazo do Simples Nacional.',
      entradas: [
        'Tipo de transformação desejado',
        'RG, CPF e comprovante de residência dos sócios que entram',
        'Divisão do capital e das quotas na nova sociedade',
        'gov.br nível Ouro de quem assina',
      ],
      passos: [
        'Abrir o processo no Painel Societário com a natureza atual (MEI, EI ou LTDA) e o destino.',
        'MEI: fazer o desenquadramento do SIMEI no Portal do Simples Nacional antes de transformar.',
        'DBE no Coletor Nacional com o evento de transformação.',
        'Gerar o documento em "Modelos de documentos" do Painel Societário: ato de transformação e contrato social da LTDA no mesmo instrumento, com a empresa individual qualificada no preâmbulo (Modelo 2 do DREI).',
        'Protocolar pelo fluxo tradicional do Facilita SP; no contrato, usar "Editar Contrato" ou anexar o documento gerado.',
        'Assinaturas, DARE, deferimento e análise de vício.',
        'Rever tributação (Simples, IE, CCM) e atualizar natureza jurídica e regime no Gestão Fiscal e no JCR Entregas.',
      ],
      checklist: ['Nova natureza jurídica no cartão CNPJ', 'Regime tributário revisto', 'Cadastro interno atualizado'],
      ferramentas: [PAINEL_SOC, { nome: 'Modelo de transformação (Word)', url: 'societario/modelos.html' }, FACILITA_SP, REDESIM],
      manuais: [MANUAIS_SOC.tradicional, MANUAIS_SOC.ltda, MANUAIS_SOC.ei],
      atencao: [
        'LTDA com um sócio só não precisa de transformação para virar "SLU": é sociedade limitada unipessoal, ajuste por alteração contratual.',
        'Exigência já recebida: "Qualificar a empresa individual no preâmbulo do instrumento e transformar para LTDA". O preâmbulo deve trazer o titular "na qualidade de empresário individual (nome empresarial atual)", com sede, NIRE e CNPJ, e a Cláusula Primeira deve transformar o registro em Sociedade Limitada. Não use modelo de alteração contratual de LTDA.',
        'A transformação precisa ser feita em instrumento único (IN DREI nº 81/2020, art. 62, § 5º): ato de transformação + contrato social consolidado.',
        'O nome empresarial atual tem de ser idêntico ao da ficha da JUCESP. Ex-MEI costuma ter o nome "00.000.000 NOME DO TITULAR".',
        'Ex-MEI: anexar a cópia do desenquadramento do SIMEI (motivo "natureza jurídica vedada").',
        'Cláusula de enquadramento: "não se enquadra" nas hipóteses de exclusão do § 4º do art. 3º da LC 123. Confira, é um erro comum.',
        ...ATENCAO_JUCESP,
      ],
      atualizado: '2026-11-13',
    },
    'societario/encerramento': {
      objetivo: 'Extinguir a empresa na JUCESP por distrato (liquidação voluntária) pelo Facilita SP, depois de resolver as pendências.',
      responsavel: 'Societário com apoio do Contábil e do Fiscal',
      prazo: 'Sob demanda, depois das pendências resolvidas.',
      entradas: [
        'Data de encerramento das atividades',
        'Bens a restituir aos sócios (dinheiro, imóveis, móveis)',
        'Quem fica com a guarda dos livros e documentos',
        'Posição final de ativo e passivo',
        'gov.br nível Ouro de todos os sócios',
      ],
      passos: [
        'Abrir o processo no Painel Societário e levantar com o cliente data de encerramento, bens a restituir e guarda dos livros.',
        'Verificar pendências: débitos e parcelamentos, notas a emitir, funcionários e eSocial, contas bancárias.',
        'Fechar a posição final de ativo e passivo com o Contábil.',
        'No Coletor Nacional, gerar o DBE de extinção por liquidação voluntária (Protocolo REDESIM).',
        'No Facilita SP, "Baixa de Pessoa Jurídica": responder o questionário (distrato padrão = fluxo rápido), informar o Protocolo REDESIM, data de encerramento, bens a restituir e responsável pelos livros.',
        'Revisar o distrato, coletar as assinaturas gov.br e pagar a DARE.',
        'Baixar a certidão de inteiro teor do distrato e aguardar a análise de vício.',
        'Abrir o processo de "Baixa nos órgãos" no Painel Societário.',
      ],
      checklist: ['Pendências resolvidas ou assumidas pelos sócios por escrito', 'Distrato deferido', 'Certidão de inteiro teor arquivada no Drive do cliente'],
      ferramentas: [PAINEL_SOC, FACILITA_SP, REDESIM],
      manuais: [MANUAIS_SOC.baixa, MANUAIS_SOC.ltda, MANUAIS_SOC.ei, MANUAIS_SOC.certidao],
      atencao: [
        'Sócio falecido: informar se há dissolução total pelos remanescentes e anexar formal de partilha (herdeiro) ou nomeação de inventariante.',
        'Sócio menor ou incapaz: representante legal obrigatório, com documento em PDF.',
        'Regime de comunhão parcial ou universal: informar CPF, nome e e-mail do cônjuge.',
        ...ATENCAO_JUCESP,
      ],
      atualizado: '2026-11-12',
    },
    'societario/baixa': {
      objetivo: 'Depois do distrato, garantir que a empresa está baixada em todos os órgãos e encerrada no escritório.',
      responsavel: 'Societário com apoio do Fiscal',
      prazo: 'Logo após o deferimento do distrato.',
      entradas: ['Certidão de inteiro teor do distrato', 'Inscrições estadual e municipal e licenças da empresa'],
      passos: [
        'Conferir no cartão CNPJ que a situação está "Baixada".',
        'Conferir a inscrição estadual na SEFAZ e a municipal na prefeitura; pedir a baixa onde ela não veio pela integração.',
        'Cancelar alvarás e licenças (Bombeiros, Vigilância Sanitária, CETESB, prefeitura).',
        'Entregar as obrigações de encerramento (com o Fiscal e o Contábil).',
        'Revogar procurações e certificados digitais; orientar o cliente a encerrar as contas bancárias.',
        'Inativar o cliente no Gestão Fiscal e no JCR Entregas e encerrar os honorários.',
      ],
      checklist: ['CNPJ baixado', 'IE e CCM baixadas', 'Licenças canceladas', 'Obrigações finais entregues', 'Cliente inativado e honorários encerrados'],
      ferramentas: [PAINEL_SOC, { nome: 'Gestão Fiscal', url: 'gclik.html' }, { nome: 'JCR Entregas', url: 'entregas/' }],
      manuais: [MANUAIS_SOC.baixa],
      atencao: ['Débitos não somem com a baixa: os sócios continuam responsáveis. Registre por escrito o que ficou pendente.'],
      atualizado: '2026-11-12',
    },
  };
})();
