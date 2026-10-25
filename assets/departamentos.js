/*
 * Catálogo do Portal JCR — departamentos, processos e ferramentas.
 *
 * Como manter:
 *  - Processo: { id, nome, freq?, procedimento? }
 *      procedimento: caminho da página do procedimento quando ele for escrito
 *      (ex.: 'procedimentos/fiscal/apuracao-icms.html'). Sem ele, o portal mostra
 *      "A documentar" e abre o modelo de procedimento já com o nome do processo.
 *  - Ferramenta: { nome, url?, desc, status }
 *      status: 'ativa' (já existe, precisa de url) | 'ideia' (automação a criar)
 *  - destaque: true → aparece no acesso rápido do topo.
 */
window.JCR_DEPARTAMENTOS = [
  {
    id: 'societario', nome: 'Societário e Legalização', ic: '🏛️', cor: '#60a5fa',
    desc: 'Abertura, alteração e baixa de empresas, licenças e certidões.',
    processos: [
      { id: 'abertura', nome: 'Abertura de empresa', freq: 'Sob demanda' },
      { id: 'alteracao-contratual', nome: 'Alteração contratual', freq: 'Sob demanda' },
      { id: 'baixa', nome: 'Baixa / encerramento de empresa', freq: 'Sob demanda' },
      { id: 'transformacao', nome: 'Transformação de tipo jurídico (MEI, LTDA, SLU)', freq: 'Sob demanda' },
      { id: 'alvaras', nome: 'Alvarás, licenças e renovações', freq: 'Anual' },
      { id: 'inscricoes', nome: 'Inscrições estadual e municipal', freq: 'Sob demanda' },
      { id: 'certificado-digital', nome: 'Controle de certificados digitais', freq: 'Contínuo' },
    ],
    ferramentas: [
      { nome: 'Checklist de abertura de empresa', desc: 'Documentos, etapas e prazos por tipo de empresa.', status: 'ideia' },
      { nome: 'Alerta de vencimento de certificados e alvarás', desc: 'Aviso automático antes de vencer.', status: 'ideia' },
    ],
  },
  {
    id: 'fiscal', nome: 'Fiscal e Tributário', ic: '🧾', cor: '#4f8ef7',
    desc: 'Escrituração, apuração de tributos e obrigações acessórias.',
    processos: [
      { id: 'importacao-notas', nome: 'Importação e conferência de notas (XML)', freq: 'Mensal' },
      { id: 'apuracao-simples', nome: 'Apuração do Simples Nacional (PGDAS-D)', freq: 'Mensal' },
      { id: 'apuracao-icms', nome: 'Apuração de ICMS / ICMS-ST / DIFAL', freq: 'Mensal' },
      { id: 'apuracao-iss', nome: 'Apuração de ISS e retenções', freq: 'Mensal' },
      { id: 'apuracao-pis-cofins', nome: 'Apuração de PIS/COFINS', freq: 'Mensal' },
      { id: 'irpj-csll', nome: 'Apuração de IRPJ/CSLL (Presumido e Real)', freq: 'Trimestral' },
      { id: 'sped-fiscal', nome: 'SPED Fiscal (EFD ICMS/IPI)', freq: 'Mensal' },
      { id: 'efd-contribuicoes', nome: 'EFD Contribuições', freq: 'Mensal' },
      { id: 'dctf', nome: 'DCTF / DCTFWeb / EFD-Reinf', freq: 'Mensal' },
      { id: 'defis', nome: 'DEFIS / DASN-SIMEI', freq: 'Anual' },
      { id: 'guias', nome: 'Emissão e envio de guias', freq: 'Mensal' },
      { id: 'fechamento-fiscal', nome: 'Fechamento fiscal mensal', freq: 'Mensal' },
      { id: 'reforma-tributaria', nome: 'Adequação à Reforma Tributária (IBS/CBS)', freq: 'Projeto' },
    ],
    ferramentas: [
      { nome: 'JCR Entregas', url: 'entregas/', desc: 'Obrigações por cliente e departamento, prazos em dia útil, metas, protocolo e portal do cliente.', status: 'ativa' },
      { nome: 'Gestão Fiscal', url: 'gclik.html', desc: 'Tarefas, obrigações, agenda e fechamento fiscal.', status: 'ativa' },
      { nome: 'EFD Contribuições', url: 'hub/efd_pis_cofins.html', desc: 'Apuração PIS/COFINS — débitos, créditos e retenções.', status: 'ativa' },
      { nome: 'Apuração ICMS — DF', url: 'hub/Apuracao_ICMS_5005_WFB.html', desc: 'Lei 5.005/2012 do Distrito Federal.', status: 'ativa' },
      { nome: 'Base de Tributação', url: 'hub/base_de_tributacao.html', desc: 'Base legal e regras de tributação.', status: 'ativa' },
      { nome: 'Analisador XML NF-e/NFC-e', url: 'hub/analisador_xml_nfe.html', desc: 'Leitura e diagnóstico de notas.', status: 'ativa' },
      { nome: 'Conferência automática de notas x SPED', desc: 'Cruza XMLs com a escrituração e aponta divergências.', status: 'ideia' },
      { nome: 'Gerador de guias e envio ao cliente', desc: 'Gera, organiza e envia guias por e-mail/WhatsApp.', status: 'ideia' },
    ],
  },
  {
    id: 'contabil', nome: 'Contábil', ic: '📒', cor: '#a78bfa',
    desc: 'Lançamentos, conciliações, demonstrações e obrigações contábeis.',
    processos: [
      { id: 'lancamentos', nome: 'Integração e lançamentos contábeis', freq: 'Mensal' },
      { id: 'conciliacao-bancaria', nome: 'Conciliação bancária', freq: 'Mensal' },
      { id: 'conciliacao-contas', nome: 'Conciliação de contas patrimoniais', freq: 'Mensal' },
      { id: 'balancete', nome: 'Balancete e fechamento mensal', freq: 'Mensal' },
      { id: 'demonstracoes', nome: 'Balanço Patrimonial e DRE', freq: 'Anual' },
      { id: 'ecd', nome: 'ECD (SPED Contábil)', freq: 'Anual' },
      { id: 'ecf', nome: 'ECF', freq: 'Anual' },
      { id: 'distribuicao-lucros', nome: 'Distribuição de lucros', freq: 'Sob demanda' },
    ],
    ferramentas: [
      { nome: 'Conciliação bancária automática (OFX)', desc: 'Importa extrato e sugere lançamentos.', status: 'ideia' },
      { nome: 'Checklist de fechamento contábil', desc: 'Etapas do fechamento por cliente com status.', status: 'ideia' },
    ],
  },
  {
    id: 'pessoal', nome: 'Departamento Pessoal', ic: '👔', cor: '#f472b6',
    desc: 'Folha, admissões, rescisões, eSocial e encargos.',
    processos: [
      { id: 'admissao', nome: 'Admissão de funcionário', freq: 'Sob demanda' },
      { id: 'folha', nome: 'Folha de pagamento', freq: 'Mensal' },
      { id: 'pro-labore', nome: 'Pró-labore', freq: 'Mensal' },
      { id: 'ferias', nome: 'Férias', freq: 'Sob demanda' },
      { id: 'decimo-terceiro', nome: '13º salário', freq: 'Anual' },
      { id: 'rescisao', nome: 'Rescisão', freq: 'Sob demanda' },
      { id: 'esocial', nome: 'eSocial', freq: 'Mensal' },
      { id: 'fgts-digital', nome: 'FGTS Digital e DCTFWeb', freq: 'Mensal' },
      { id: 'afastamentos', nome: 'Afastamentos e atestados', freq: 'Sob demanda' },
    ],
    ferramentas: [
      { nome: 'Formulário de admissão para o cliente', desc: 'Cliente envia os dados e documentos do novo funcionário.', status: 'ideia' },
      { nome: 'Calculadora de rescisão e férias', desc: 'Simulação rápida para responder o cliente.', status: 'ideia' },
    ],
  },
  {
    id: 'bpo', nome: 'BPO Financeiro', ic: '💳', cor: '#22d3ee',
    desc: 'Gestão financeira terceirizada para os clientes.',
    processos: [
      { id: 'onboarding-bpo', nome: 'Implantação do cliente no BPO', freq: 'Sob demanda' },
      { id: 'contas-pagar', nome: 'Contas a pagar e agendamento de pagamentos', freq: 'Diário' },
      { id: 'contas-receber', nome: 'Contas a receber e baixas', freq: 'Diário' },
      { id: 'cobranca-clientes-bpo', nome: 'Cobrança de inadimplentes do cliente', freq: 'Semanal' },
      { id: 'emissao-nf', nome: 'Emissão de notas fiscais e boletos', freq: 'Sob demanda' },
      { id: 'conciliacao-bpo', nome: 'Conciliação bancária e de cartões', freq: 'Diário' },
      { id: 'fluxo-caixa', nome: 'Fluxo de caixa e projeções', freq: 'Semanal' },
      { id: 'relatorio-gerencial', nome: 'Relatório gerencial / DRE gerencial', freq: 'Mensal' },
      { id: 'reuniao-resultados', nome: 'Reunião de resultados com o cliente', freq: 'Mensal' },
    ],
    ferramentas: [
      { nome: 'Conciliação Conta Azul', url: 'conciliacao/', desc: 'Extrato OFX/CSV × contas a pagar/receber: baixa em lote, tarifas, juros e resumo do fechamento.', status: 'ativa' },
      { nome: 'Contas a pagar do dia', url: 'contas-pagar/', desc: 'Monta a lista de pagamentos do dia: busca as contas em aberto no Conta Azul (ou importa a planilha), marca o que paga, saldos dos bancos com sobra/falta, alertas de protesto e duplicadas, planilha do dia, resumo para o cliente e lista Pix.', status: 'ativa' },
      { nome: 'Gerador de lista Pix (Unicred)', url: 'pix-lote/', desc: 'Cola a planilha (nome, CPF, chave, valor) e gera a lista no layout da extensão de Pix em lote: valida CPF, padroniza chaves e avisa repetidos.', status: 'ativa' },
      { nome: 'Painel financeiro do cliente', desc: 'Caixa, contas a pagar/receber e indicadores.', status: 'ideia' },
      { nome: 'Agenda de pagamentos com aprovação', desc: 'Cliente aprova os pagamentos do dia pelo celular.', status: 'ideia' },
      { nome: 'Gerador de relatório gerencial', desc: 'DRE gerencial e fluxo de caixa em PDF automático.', status: 'ideia' },
    ],
  },
  {
    id: 'recuperacao', nome: 'Recuperação Tributária e Consultoria', ic: '⚖️', cor: '#fbbf24',
    desc: 'Teses, revisão fiscal, créditos e planejamento tributário.',
    processos: [
      { id: 'diagnostico', nome: 'Diagnóstico tributário do cliente', freq: 'Sob demanda' },
      { id: 'revisao-fiscal', nome: 'Revisão fiscal (últimos 5 anos)', freq: 'Sob demanda' },
      { id: 'teses-adm', nome: 'Teses administrativas (PER/DCOMP)', freq: 'Sob demanda' },
      { id: 'teses-jud', nome: 'Teses judiciais (com advogado parceiro)', freq: 'Sob demanda' },
      { id: 'planejamento', nome: 'Planejamento tributário / escolha de regime', freq: 'Anual' },
      { id: 'parcelamentos', nome: 'Parcelamentos e transações', freq: 'Sob demanda' },
    ],
    ferramentas: [
      { nome: 'Recuperação Tributária', url: 'hub/recuperacao_tributaria.html', desc: '12 teses ADM e JUD com manual de procedimentos.', status: 'ativa' },
      { nome: 'Analisador Multi-Teses', url: 'hub/jcr_analisador_multiteses.html', desc: 'Upload de SPED e análise de todas as teses.', status: 'ativa' },
      { nome: 'Exclusão PIS/COFINS da própria base', url: 'hub/analisador_pis_cofins_base.html', desc: 'Gross up reverso — RE 574.706/PR.', status: 'ativa' },
      { nome: 'Simulador de regime tributário', desc: 'Compara Simples, Presumido e Real.', status: 'ideia' },
    ],
  },
  {
    id: 'fiscalizacao', nome: 'Fiscalização, Certidões e Notificações', ic: '🔔', cor: '#34d399',
    desc: 'Intimações, malhas, pendências no e-CAC e certidões negativas.',
    processos: [
      { id: 'notificacoes', nome: 'Tratamento de notificações e intimações', freq: 'Sob demanda' },
      { id: 'ecac', nome: 'Monitoramento da caixa postal e-CAC / DTE', freq: 'Semanal' },
      { id: 'cnd', nome: 'Emissão e controle de certidões negativas', freq: 'Mensal' },
      { id: 'situacao-fiscal', nome: 'Relatório de situação fiscal', freq: 'Mensal' },
      { id: 'defesas', nome: 'Impugnações e defesas administrativas', freq: 'Sob demanda' },
    ],
    ferramentas: [
      { nome: 'Notificações Fiscais', url: 'notificacoes/', desc: 'Controle de notificações e prazos, com leitura de PDF.', status: 'ativa' },
      { nome: 'Radar Tributário', url: 'hub/radar-tributario.html', desc: 'Novidades tributárias por período.', status: 'ativa' },
      { nome: 'Monitor de certidões (CND)', desc: 'Consulta periódica e alerta de pendências.', status: 'ideia' },
    ],
  },
  {
    id: 'irpf', nome: 'Imposto de Renda Pessoa Física', ic: '🧑‍💼', cor: '#fb923c',
    desc: 'Declarações de IRPF, carnê-leão e ganho de capital.',
    processos: [
      { id: 'coleta-documentos', nome: 'Coleta de documentos do cliente', freq: 'Anual' },
      { id: 'declaracao', nome: 'Elaboração e entrega da declaração', freq: 'Anual' },
      { id: 'carne-leao', nome: 'Carnê-leão', freq: 'Mensal' },
      { id: 'ganho-capital', nome: 'Ganho de capital (GCAP)', freq: 'Sob demanda' },
      { id: 'malha-irpf', nome: 'Malha fina e retificação', freq: 'Sob demanda' },
    ],
    ferramentas: [
      { nome: 'IRPF — clientes e declarações', url: 'gclik.html?abrir=irpf', desc: 'Todos os clientes de IRPF e o status de cada declaração.', status: 'ativa' },
      { nome: 'Portal de envio de documentos do IRPF', desc: 'Cliente envia informes e recibos por um link.', status: 'ideia' },
    ],
  },
  {
    id: 'comercial', nome: 'Comercial e Atendimento', ic: '🎯', cor: '#f87171',
    desc: 'Captação, propostas, entrada de clientes e relacionamento.',
    processos: [
      { id: 'prospeccao', nome: 'Prospecção e funil de vendas', freq: 'Contínuo' },
      { id: 'proposta', nome: 'Proposta comercial e precificação', freq: 'Sob demanda' },
      { id: 'contrato', nome: 'Contrato de prestação de serviços', freq: 'Sob demanda' },
      { id: 'onboarding', nome: 'Entrada de novo cliente (onboarding)', freq: 'Sob demanda' },
      { id: 'atendimento', nome: 'Atendimento e suporte ao cliente', freq: 'Diário' },
      { id: 'pesquisa-satisfacao', nome: 'Pesquisa de satisfação', freq: 'Semestral' },
    ],
    ferramentas: [
      { nome: 'Comercial', url: 'hub/comercial.html', desc: 'Funil, scripts de WhatsApp e precificação.', status: 'ativa' },
      { nome: 'Clientes', url: 'hub/clientes.html', desc: 'Ficha por cliente com oportunidades e passivo fiscal.', status: 'ativa' },
      { nome: 'Gerador de proposta comercial', desc: 'Proposta em PDF a partir do perfil do cliente.', status: 'ideia' },
    ],
  },
  {
    id: 'financeiro', nome: 'Financeiro do Escritório', ic: '💰', cor: '#4ade80',
    desc: 'Honorários, cobrança e contas do próprio escritório.',
    processos: [
      { id: 'honorarios', nome: 'Cobrança de honorários', freq: 'Mensal' },
      { id: 'reajuste', nome: 'Reajuste anual de honorários', freq: 'Anual' },
      { id: 'inadimplencia', nome: 'Controle de inadimplência', freq: 'Mensal' },
      { id: 'contas-escritorio', nome: 'Contas a pagar do escritório', freq: 'Mensal' },
      { id: 'resultado-escritorio', nome: 'Resultado mensal do escritório', freq: 'Mensal' },
    ],
    ferramentas: [
      { nome: 'Honorários no Gestão Fiscal', url: 'gclik.html', desc: 'Lançamento e acompanhamento de honorários.', status: 'ativa' },
      { nome: 'Cobrança automática de honorários', desc: 'Boleto/Pix e lembrete automático.', status: 'ideia' },
    ],
  },
  {
    id: 'administrativo', nome: 'Administrativo e Gestão', ic: '🏢', cor: '#94a3b8',
    desc: 'Estrutura do escritório, equipe, qualidade, TI e LGPD.',
    processos: [
      { id: 'rotina-equipe', nome: 'Distribuição de tarefas e rotina da equipe', freq: 'Diário' },
      { id: 'contratacao', nome: 'Contratação e integração de colaboradores', freq: 'Sob demanda' },
      { id: 'documentos-cliente', nome: 'Recebimento e arquivo de documentos', freq: 'Contínuo' },
      { id: 'lgpd', nome: 'LGPD e segurança da informação', freq: 'Contínuo' },
      { id: 'indicadores', nome: 'Indicadores e metas do escritório', freq: 'Mensal' },
    ],
    ferramentas: [
      { nome: 'Hub JCR', url: 'hub/index.html', desc: 'Painel do escritório e próximos passos.', status: 'ativa' },
      { nome: 'Organograma detalhado', url: 'hub/organograma_detalhado_jcr.html', desc: 'Estrutura com departamentos e manual.', status: 'ativa' },
      { nome: 'Processo comercial', url: 'hub/organograma_processo_comercial_jcr.html', desc: 'Organograma do processo comercial.', status: 'ativa' },
      { nome: 'Mapa estratégico', url: 'hub/mapa_escritorio_jcr.html', desc: 'Mapa estratégico JCR + Wesley.', status: 'ativa' },
      { nome: 'Proposta de Sociedade', url: 'hub/proposta_sociedade_jcr.html', desc: 'JCR + Wesley.', status: 'ativa' },
      { nome: 'Arquitetura do sistema', url: 'hub/arquitetura_sistema_jcr.html', desc: 'Stack, banco de dados, telas e roadmap.', status: 'ativa' },
      { nome: 'Ferramentas extras', url: 'hub/ferramentas.html', desc: 'Suas ferramentas HTML cadastradas.', status: 'ativa' },
      { nome: 'Pomodoro', url: 'hub/jcr_pomodoro.html', desc: 'Foco e histórico de sessões.', status: 'ativa' },
    ],
  },
  {
    id: 'conhecimento', nome: 'Conhecimento e Treinamento', ic: '🎓', cor: '#c084fc',
    desc: 'Cursos, legislação, materiais e capacitação da equipe.',
    processos: [
      { id: 'atualizacao-legislacao', nome: 'Acompanhamento de legislação', freq: 'Semanal' },
      { id: 'treinamento', nome: 'Treinamento de novos colaboradores', freq: 'Sob demanda' },
      { id: 'plano-estudos', nome: 'Plano de estudos e cursos', freq: 'Contínuo' },
    ],
    ferramentas: [
      { nome: 'Base de Conhecimento', url: 'hub/gclik_conhecimento.html', desc: 'Inventário de cursos, anotações e metas.', status: 'ativa' },
      { nome: 'Central de Materiais', url: 'hub/jcr-conhecimento-index.html', desc: 'Materiais e documentos do escritório.', status: 'ativa' },
      { nome: 'Legislação & Reforma', url: 'hub/legislacao_reforma.html', desc: 'Reforma IBS/CBS, teses STF/STJ e benefícios.', status: 'ativa' },
    ],
  },
];

window.JCR_ACESSO_RAPIDO = [
  { nome: 'Entregas', url: 'entregas/', ic: '✅' },
  { nome: 'Gestão Fiscal', url: 'gclik.html', ic: '📊' },
  { nome: 'IRPF', url: 'gclik.html?abrir=irpf', ic: '🧑‍💼' },
  { nome: 'Notificações', url: 'notificacoes/', ic: '🔔' },
  { nome: 'Conciliação', url: 'conciliacao/', ic: '💳' },
  { nome: 'Hub JCR', url: 'hub/index.html', ic: '🧭' },
];
