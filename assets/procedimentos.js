/*
 * Procedimentos (POPs) dos processos do Portal JCR.
 *
 * A chave é "departamento/processo", com os ids de assets/departamentos.js.
 * Quando um processo tem procedimento aqui, o portal mostra "Procedimento"
 * em vez de "A documentar".
 *
 * Campos (todos opcionais, exceto passos):
 *   objetivo, responsavel, prazo, entradas: [], passos: [], checklist: [],
 *   ferramentas: [{ nome, url }], atencao: [], atualizado: 'AAAA-MM-DD'
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
window.JCR_PROCEDIMENTOS = {
};
