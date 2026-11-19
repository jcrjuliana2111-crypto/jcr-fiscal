// node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const O = require('../comercial/onboarding-core.js');

const precos = { ...O.PRECOS_PADRAO,
  base: { ...O.PRECOS_PADRAO.base, 'Simples Nacional|servicos': 600, 'Lucro Presumido|servicos': 1200 },
  funcionarios_inclusos: 2, por_funcionario: 40, por_socio_prolabore: 30,
  faixas_notas: [{ ate: 50, valor: 0 }, { ate: 150, valor: 100 }, { ate: null, valor: 250 }],
  servicos: O.PRECOS_PADRAO.servicos.map(s => s.id === 'abertura' ? { ...s, valor: 900 } : s.id === 'bpo' ? { ...s, valor: 500 } : s.id === 'recuperacao' ? { ...s, percentual: 20 } : s) };
const dados = { nome: 'Exemplo Serviços Ltda', documento: '11.222.333/0001-81', regime: 'Simples Nacional', atividade: 'servicos', funcionarios: 5, socios_prolabore: 2, notas_mes: 80,
  servicos: ['abertura', 'bpo', 'recuperacao'], desconto_pct: 10, email: 'contato@exemplo.com', inicio: '2026-12-01', dia_vencimento: 10 };
const cfg = { precos, escritorio: { nome: 'JCR Consultoria', cnpj: '00.000.000/0001-00', crc: '1SP000000/O-0', responsavel: 'Fulana de Tal', endereco: 'Rua X, 1, Campinas/SP', cidade: 'Campinas/SP' }, textos: { apresentacao: 'Escritório contábil.' } };

test('orçamento: base + folha + pró-labore + faixa de notas + serviço mensal − desconto', () => {
  const o = O.calcularOrcamento(precos, dados);
  // 600 + 3×40 + 2×30 + 100 + 500 = 1380; −10% = 1242
  assert.strictEqual(o.subtotal, 1380);
  assert.strictEqual(o.mensal, 1242);
  assert.strictEqual(o.anual, 1242 * 13);
  assert.deepStrictEqual(o.avulsos, [{ nome: 'Abertura de empresa', valor: 900 }]);
  assert.strictEqual(o.exito[0].percentual, 20);
  assert.deepStrictEqual(o.avisos, []);
});

test('avisos: sem preço na tabela e desconto acima do máximo', () => {
  const o = O.calcularOrcamento(O.PRECOS_PADRAO, { regime: 'Lucro Real', desconto_pct: 30, servicos: ['irpf'] });
  assert.ok(o.avisos.some(a => a.includes('Lucro Real')));
  assert.ok(o.avisos.some(a => a.includes('30%')));
  assert.ok(o.avisos.some(a => a.includes('IRPF')));
});

test('escopo muda com o regime e a folha', () => {
  const mei = O.escopo({ regime: 'MEI' }).map(g => g.area);
  assert.deepStrictEqual(mei, ['Fiscal', 'Atendimento']);
  const lp = O.escopo({ regime: 'Lucro Presumido', funcionarios: 1 });
  assert.ok(lp.some(g => g.area === 'Pessoal'));
  assert.ok(lp.find(g => g.area === 'Contábil').itens.some(i => /ECD/.test(i)));
});

test('proposta e contrato completos não têm campo faltando', () => {
  const op = { dados: { ...dados, endereco: 'Av. Y, 2, Campinas/SP', representante: 'Beltrano', representante_cpf: '529.982.247-25' }, data_proposta: '2026-11-19', contrato: { assinado_em: '2026-11-25' } };
  const falta = bl => bl.flatMap(b => (b.partes || []).concat(...(b.linhas || []))).filter(p => p && typeof p === 'object');
  const pr = O.proposta(op, cfg);
  assert.deepStrictEqual(falta(pr.blocos), []);
  assert.strictEqual(pr.validade, '2026-12-04');
  assert.ok(pr.blocos.some(b => b.tipo === 'tabela' && b.linhas.some(l => l[1] === 'R$ 1.242,00')));
  const ct = O.contrato(op, cfg);
  assert.deepStrictEqual(falta(ct.blocos), []);
  const texto = ct.blocos.map(b => (b.partes || []).join('')).join(' ');
  assert.ok(texto.includes('R$ 1.242,00') && texto.includes('LGPD') && texto.includes('aviso prévio'));
  // sem dados: aparece o que falta
  assert.ok(falta(O.contrato({ dados: {} }, {}).blocos).length > 5);
});

test('checklist por perfil e boas-vindas com pendências', () => {
  const op = { dados: { ...dados, origem_contabil: 'outro_contador', societario: 'nao' }, checklist: { doc_certificado: true } };
  const grupos = O.checklist(op).map(g => g.grupo);
  assert.ok(grupos.includes('Transferência do contador anterior'));
  assert.ok(O.checklist(op).flatMap(g => g.itens).some(i => i.id === 'doc_folha'));
  const nova = O.checklist({ dados: { regime: 'MEI', societario: 'abertura' } });
  assert.ok(!nova.some(g => g.grupo === 'Diagnóstico inicial'));
  assert.ok(nova.flatMap(g => g.itens).some(i => i.id === 'cad_societario'));
  const bv = O.boasVindas(op, cfg, { portal: 'https://portal/x' });
  assert.ok(bv.assunto.includes('JCR Consultoria'));
  assert.ok(bv.corpo.includes('https://portal/x') && bv.corpo.includes('Procuração eletrônica') && !bv.corpo.includes('Certificado digital A1'));
  assert.strictEqual(O.progresso(op).feitos, 1);
});

test('etapa só avança com os dados mínimos; cliente para o Gestão Fiscal', () => {
  assert.deepStrictEqual(O.faltando({ dados: {} }, 'orcamento'), ['nome do cliente', 'regime', 'e-mail ou WhatsApp']);
  assert.ok(O.faltando({ dados }, 'implantacao').includes('data de assinatura do contrato'));
  const g = O.clienteGestao({ dados, orcamento: O.calcularOrcamento(precos, dados) }, 'esc1');
  assert.strictEqual(g.honor_mensal, 1242);
  assert.strictEqual(g.regime, 'Simples Nacional');
  assert.strictEqual(g.status, 'Ativo');
});

test('boas-vindas sem WhatsApp do escritório não deixa buraco no texto', () => {
  const bv = O.boasVindas({ dados: { nome: 'X', responsavel: 'Ana' } }, { escritorio: { nome: 'JCR' } });
  assert.ok(bv.corpo.includes('Seu atendimento é com Ana, por este e-mail.'));
  const bv2 = O.boasVindas({ dados: { nome: 'X' } }, { escritorio: { nome: 'JCR', whatsapp: '(19) 3333-0000', responsavel: 'Bia' } });
  assert.ok(bv2.corpo.includes('com Bia, pelo WhatsApp (19) 3333-0000 ou por este e-mail.'));
});
