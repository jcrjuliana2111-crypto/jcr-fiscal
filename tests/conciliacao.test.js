// node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const C = require('../conciliacao/conciliacao-core.js');

test('parseValorBR', () => {
  assert.strictEqual(C.parseValorBR('1.234,56'), 1234.56);
  assert.strictEqual(C.parseValorBR('-150,00'), -150);
  assert.strictEqual(C.parseValorBR('R$ 99,90'), 99.9);
  assert.strictEqual(C.parseValorBR('250.75'), 250.75);
  assert.strictEqual(C.parseValorBR('300,00 D'), -300);
});

test('parseOFX', () => {
  const ofx = `OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261001120000[-3:BRT]<TRNAMT>1500.00<FITID>A1<MEMO>PIX RECEBIDO ACME COMERCIO
</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261002<TRNAMT>-320.40<FITID>A2<NAME>ENEL<MEMO>PAGTO BOLETO
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
  const r = C.parseOFX(ofx);
  assert.deepStrictEqual(r, [
    { id: 'A1', data: '2026-10-01', valor: 1500, historico: 'PIX RECEBIDO ACME COMERCIO' },
    { id: 'A2', data: '2026-10-02', valor: -320.4, historico: 'ENEL PAGTO BOLETO' }
  ]);
});

test('parseCSV com ; e colunas crédito/débito', () => {
  const csv = 'Data;Histórico;Crédito;Débito\n01/10/2026;"PIX ACME";1.500,00;\n02/10/2026;ENEL;;320,40\n';
  const r = C.parseCSV(csv);
  assert.strictEqual(r.length, 2);
  assert.strictEqual(r[0].valor, 1500);
  assert.strictEqual(r[1].valor, -320.4);
  assert.strictEqual(r[1].data, '2026-10-02');
});

test('conciliar casa por valor, data e nome, sem reutilizar parcelas', () => {
  const movs = [
    { id: 'm1', data: '2026-10-01', valor: 1500, historico: 'PIX RECEBIDO ACME COMERCIO' },
    { id: 'm2', data: '2026-10-02', valor: -320.4, historico: 'ENEL PAGTO BOLETO' },
    { id: 'm3', data: '2026-10-03', valor: 1500, historico: 'TED BETA SERVICOS' },
    { id: 'm4', data: '2026-10-03', valor: 77.77, historico: 'X' }
  ];
  const parcelas = [
    { id: 'p1', tipo: 'receber', vencimento: '2026-10-01', valor: 1500, nome: 'Beta Serviços Ltda' },
    { id: 'p2', tipo: 'receber', vencimento: '2026-09-30', valor: 1500, nome: 'ACME Comércio' },
    { id: 'p3', tipo: 'pagar', vencimento: '2026-10-02', valor: 320.4, nome: 'Enel Distribuição' },
    { id: 'p4', tipo: 'pagar', vencimento: '2026-10-03', valor: 77.77, nome: 'Outro' }
  ];
  const r = C.conciliar(movs, parcelas, { janelaDias: 5 });
  const mapa = Object.fromEntries(r.pares.map(p => [p.movimento.id, p.parcela.id]));
  assert.strictEqual(mapa.m1, 'p2');
  assert.strictEqual(mapa.m3, 'p1');
  assert.strictEqual(mapa.m2, 'p3');
  assert.strictEqual(mapa.m4, undefined); // entrada não casa com conta a pagar
  assert.deepStrictEqual(r.semParcela.map(m => m.id), ['m4']);
  assert.deepStrictEqual(r.parcelasSemMovimento.map(p => p.id), ['p4']);
  assert.ok(r.pares.every(p => p.confianca === 'alta'));
});

test('conciliar respeita a janela de dias', () => {
  const r = C.conciliar(
    [{ id: 'm', data: '2026-10-20', valor: 100, historico: '' }],
    [{ id: 'p', tipo: 'receber', vencimento: '2026-10-01', valor: 100, nome: '' }],
    { janelaDias: 5 });
  assert.strictEqual(r.pares.length, 0);
});

test('dadosComprovante lê valores e datas do texto e do nome do arquivo', () => {
  const t = 'Comprovante de Pix\nValor R$ 1.320,40\nData 02/10/2026 14:31\nTarifa R$ 0,00\nFavorecido ENEL DISTRIBUICAO';
  const d = C.dadosComprovante(t, 'pix.pdf');
  assert.deepStrictEqual(d.valores.sort((a, b) => a - b), [132040]);
  assert.deepStrictEqual(d.datas, ['2026-10-02']);
  const n = C.dadosComprovante('', '2026-10-05_aluguel_2500.00.png');
  assert.deepStrictEqual(n.valores, [250000]);
  assert.deepStrictEqual(n.datas, ['2026-10-05']);
  assert.deepStrictEqual(C.dadosComprovante('', 'ENEL 05-10-2026 320,40.jpg').datas, ['2026-10-05']);
});

test('casarComprovantes liga por valor, data e nome', () => {
  const pares = [
    { movimento: { id: 'm1', data: '2026-10-01', valor: -500, historico: 'PIX ENVIADO' }, parcela: { nome: 'Alfa Ltda' } },
    { movimento: { id: 'm2', data: '2026-10-01', valor: -500, historico: 'PIX ENVIADO' }, parcela: { nome: 'Beta SA' } },
    { movimento: { id: 'm3', data: '2026-10-05', valor: 80, historico: 'TED' }, parcela: { nome: 'Gama' } },
    { movimento: { id: 'm4', data: '2026-10-06', valor: -42.5, historico: 'BOLETO' }, parcela: { nome: 'Delta' } }
  ];
  const comps = [
    { id: 'c1', valores: [50000, 0], datas: ['2026-10-01'], texto: 'BETA SA' },
    { id: 'c2', valores: [50000], datas: ['2026-10-02'], texto: 'ALFA LTDA' },
    { id: 'c3', valores: [8000], datas: ['2026-10-20'], texto: 'Gama' }, // fora da janela
    { id: 'c4', valores: [4250], datas: [], texto: 'boleto delta' }      // sem data: só valor
  ];
  assert.deepStrictEqual(C.casarComprovantes(pares, comps, { janelaDias: 3 }), { m1: 'c2', m2: 'c1', m4: 'c4' });
});

test('formatos do escritório: PIX com descrição e fornecedor com V ddmmaa', () => {
  const pix = C.dadosComprovante('FAVORECIDO: ALANA GONCALVES RODRIGUES\nVALOR R$ 490,00\nTIPO: PIX ENVIADO -\nFOLHA MULTI AGO 26', 'a.pdf');
  assert.deepStrictEqual(pix.valores, [49000]);
  assert.deepStrictEqual(pix.datas, []);
  const forn = C.dadosComprovante('', 'FORNECEDOR F F DISTRIBUIDORA DE PRODUTOS R$ 964,62 V 051026.pdf');
  assert.deepStrictEqual(forn.valores, [96462]);
  assert.deepStrictEqual(forn.vencimentos, ['2026-10-05']);
  assert.deepStrictEqual(forn.datas, []);
  assert.deepStrictEqual(C.dadosComprovante('VENCIMENTO: V051026', '').vencimentos, ['2026-10-05']);

  // duas folhas de R$ 490,00: cada uma vai para a pessoa certa pelo nome/descrição
  const pares = [
    { movimento: { id: 'm1', data: '2026-10-06', valor: -490, historico: 'PIX ENVIADO' },
      parcela: { nome: 'Bruno Lima', descricao: 'FOLHA MULTI AGO 26', vencimento: '2026-10-05' } },
    { movimento: { id: 'm2', data: '2026-10-06', valor: -490, historico: 'PIX ENVIADO' },
      parcela: { nome: 'Alana Goncalves Rodrigues', descricao: 'FOLHA MULTI AGO 26', vencimento: '2026-10-05' } },
    { movimento: { id: 'm3', data: '2026-10-07', valor: -964.62, historico: 'PAG BOLETO' },
      parcela: { nome: 'F F Distribuidora', descricao: 'Compra mercadoria', vencimento: '2026-10-05' } },
    { movimento: { id: 'm4', data: '2026-10-07', valor: -964.62, historico: 'PAG BOLETO' },
      parcela: { nome: 'F F Distribuidora', descricao: 'Compra mercadoria', vencimento: '2026-10-20' } }
  ];
  const r = C.casarComprovantes(pares, [{ id: 'pix', ...pix }, { id: 'forn', ...forn }], { janelaDias: 3 });
  assert.deepStrictEqual(r, { m2: 'pix', m3: 'forn' });
});

test('comprovante sem data e sem nome só é ligado se não houver ambiguidade', () => {
  const par = (id, nome) => ({ movimento: { id, data: '2026-10-06', valor: -490, historico: '' }, parcela: { nome, descricao: 'x' } });
  const c = [{ id: 'c', valores: [49000], datas: [], vencimentos: [], texto: 'VALOR R$ 490,00' }];
  assert.deepStrictEqual(C.casarComprovantes([par('m1', 'Ana')], c), { m1: 'c' });
  assert.deepStrictEqual(C.casarComprovantes([par('m1', 'Ana'), par('m2', 'Bia')], c), {});
});

test('nome do arquivo + texto do PDF juntos', () => {
  // fornecedor pago com atraso: vencimento 05/10 (nome e texto), pago 09/10
  const forn = C.dadosComprovante(
    'Comprovante de pagamento de boleto\nBeneficiário: F F DISTRIBUIDORA DE PRODUTOS LTDA\n' +
    'Data de vencimento: 05/10/2026\nData do pagamento: 09/10/2026\nValor do documento: R$ 964,62\nValor pago: R$ 964,62',
    'FORNECEDOR F F DISTRIBUIDORA DE PRODUTOS R$ 964,62 V 051026.pdf');
  assert.deepStrictEqual(forn.valores, [96462]);
  assert.deepStrictEqual(forn.vencimentos, ['2026-10-05']);
  assert.deepStrictEqual(forn.datas, ['2026-10-09']);

  // PIX: nome do arquivo com favorecido/descrição, data só no texto do PDF
  const pix = C.dadosComprovante('Pix enviado\n06/10/2026 - 10:42\nValor R$ 490,00\nPara ALANA GONCALVES RODRIGUES',
    'FAVORECIDO ALANA GONCALVES RODRIGUES R$ 490,00 PIX ENVIADO - FOLHA MULTI AGO 26.pdf');
  assert.deepStrictEqual(pix.valores, [49000]);
  assert.deepStrictEqual(pix.datas, ['2026-10-06']);

  const pares = [
    { movimento: { id: 'b1', data: '2026-10-09', valor: -964.62, historico: 'PAG BOLETO' },
      parcela: { nome: 'F F Distribuidora de Produtos', descricao: 'NF 1234', vencimento: '2026-10-05' } },
    { movimento: { id: 'p1', data: '2026-10-06', valor: -490, historico: 'PIX ENVIADO ALANA' },
      parcela: { nome: 'Alana Goncalves Rodrigues', descricao: 'FOLHA MULTI AGO 26', vencimento: '2026-10-05' } }
  ];
  assert.deepStrictEqual(C.casarComprovantes(pares, [{ id: 'f', ...forn }, { id: 'x', ...pix }]), { b1: 'f', p1: 'x' });
});

test('nomeNoExtrato pega o favorecido de PIX/TED e ignora boleto/tarifa', () => {
  assert.strictEqual(C.nomeNoExtrato('DEBITO TRANSFERENCIA PIX ( DOC.: DEB PIX / ROGERIO LIMA DOS SANTOS )'), 'rogerio lima santos');
  assert.strictEqual(C.nomeNoExtrato('TED BETA SERVICOS'), 'beta servicos');
  assert.strictEqual(C.nomeNoExtrato('LIQUIDACAO DE TITULO - IB ( DOC.: 1368293600 / VA EXTRA RIO'), '');
  assert.strictEqual(C.nomeNoExtrato('TARIFA PIX'), '');
  assert.strictEqual(C.nomeNoExtrato('ENEL PAGTO BOLETO'), '');
});

test('PIX com nome diferente não vira sugestão: fica como possível (caso real 16/10)', () => {
  const movs = [
    { id: 'm1', data: '2026-10-16', valor: -323, historico: 'DEBITO TRANSFERENCIA PIX ( DOC.: DEB PIX / ROGERIO LIMA DOS SANTOS )' },
    { id: 'm2', data: '2026-10-16', valor: -200, historico: 'DEBITO TRANSFERENCIA PIX ( DOC.: DEB PIX / THAINA GOULART RIBEIRO )' },
    { id: 'm3', data: '2026-10-16', valor: -150, historico: 'DEBITO TRANSFERENCIA PIX ( DOC.: DEB PIX / MARIA CLARA SOUZA )' }
  ];
  const parcelas = [
    { id: 'p1', tipo: 'pagar', vencimento: '2026-10-16', valor: 323, nome: 'Carlos Roberto de Oliveira Santos', descricao: 'PAGAMENTO PLANTÃO EXTRA' },
    { id: 'p2', tipo: 'pagar', vencimento: '2026-10-19', valor: 200, nome: 'ZELO HEALTH CARE', descricao: 'MATERIAL MEDICO' },
    { id: 'p3', tipo: 'pagar', vencimento: '2026-10-16', valor: 150, nome: 'Maria Clara Souza Lima', descricao: 'PLANTÃO' }
  ];
  const r = C.conciliar(movs, parcelas, { janelaDias: 5 });
  assert.deepStrictEqual(r.pares.map(p => [p.movimento.id, p.parcela.id, p.confianca]), [['m3', 'p3', 'alta']]);
  const sem = Object.fromEntries(r.semParcela.map(m => [m.id, (m.possiveis || []).map(x => x.parcela.id)]));
  assert.deepStrictEqual(sem, { m1: ['p1'], m2: ['p2'] });
});

test('boleto sem nome no extrato, único candidato: sugestão média (conferir)', () => {
  const r = C.conciliar(
    [{ id: 'm', data: '2026-10-16', valor: -485.6, historico: 'LIQUIDACAO DE TITULO - IB ( DOC.: 1368293600 / 0120682000010' }],
    [{ id: 'p', tipo: 'pagar', vencimento: '2026-10-16', valor: 485.6, nome: 'Fornecedor X', descricao: 'NF 10' }],
    { janelaDias: 5 });
  assert.strictEqual(r.pares[0].confianca, 'media');
});

test('juros/multa e desconto: mesmo contato, valor diferente', () => {
  const movs = [
    { id: 'j', data: '2026-10-12', valor: -1030, historico: 'TED ALFA LOCACOES' },   // pagou com atraso
    { id: 'd', data: '2026-10-01', valor: 970, historico: 'PIX RECEBIDO BETA COMERCIO' }, // cliente pagou com desconto
    { id: 'x', data: '2026-10-01', valor: -700, historico: 'TED GAMA LTDA COMERCIO' }  // diferença grande demais
  ];
  const parcelas = [
    { id: 'pj', tipo: 'pagar', vencimento: '2026-10-05', valor: 1000, nome: 'Alfa Locações' },
    { id: 'pd', tipo: 'receber', vencimento: '2026-10-05', valor: 1000, nome: 'Beta Comércio' },
    { id: 'px', tipo: 'pagar', vencimento: '2026-10-01', valor: 1000, nome: 'Gama Comercio' }
  ];
  const r = C.conciliar(movs, parcelas, { janelaDias: 5 });
  const m = Object.fromEntries(r.pares.map(p => [p.movimento.id, [p.parcela.id, p.confianca, p.ajuste]]));
  assert.deepStrictEqual(m.j, ['pj', 'media', { tipo: 'juros', valor: 30 }]);
  assert.deepStrictEqual(m.d, ['pd', 'media', { tipo: 'desconto', valor: 30 }]);
  assert.strictEqual(m.x, undefined);
});

test('montarPar (vínculo manual) calcula dias e ajuste', () => {
  const p = C.montarPar({ id: 'm', data: '2026-10-10', valor: -110 }, { id: 'p', vencimento: '2026-10-05', valor: 100 });
  assert.strictEqual(p.confianca, 'manual');
  assert.strictEqual(p.dias, 5);
  assert.deepStrictEqual(p.ajuste, { tipo: 'juros', valor: 10 });
});

test('comprovante com o nome do contato reforça sugestão média', () => {
  const pares = [{ movimento: { id: 'm', valor: -485.6 }, parcela: { nome: 'Fornecedor Xis' }, confianca: 'media', dias: 0, ajuste: null }];
  const sub = C.reforcarComComprovantes(pares, { m: 'c' }, [{ id: 'c', texto: 'FORNECEDOR XIS R$ 485,60' }]);
  assert.deepStrictEqual(sub, ['m']);
  assert.strictEqual(pares[0].confianca, 'alta');
});

test('resumoFechamento lista baixas, pendências e vencidos', () => {
  const movs = [{ id: 'a', data: '2026-10-16', valor: -100, historico: 'X' }, { id: 'b', data: '2026-10-16', valor: -12.5, historico: 'TARIFA' }];
  const resultado = {
    pares: [{ movimento: movs[0], parcela: { valor: 100 }, ajuste: null }],
    semParcela: [movs[1]],
    parcelasSemMovimento: [{ vencimento: '2026-10-01', valor: 50, tipo: 'receber', nome: 'Cliente Y' }]
  };
  const t = C.resumoFechamento({ cliente: 'Clínica', de: '2026-10-16', ate: '2026-10-16', movimentos: movs, resultado,
    retornos: { a: { status: 'ok' } }, hoje: '2026-10-17' });
  assert.match(t, /Baixados no Conta Azul: 1 \(R\$ 100,00\)/);
  assert.match(t, /sem lançamento: 1 \(R\$ 12,50\)/);
  assert.match(t, /Vencidos .*: 1 \(R\$ 50,00\)/);
});

test('cópia do motor na skill está igual à do robô', () => {
  const fs = require('fs');
  const path = require('path');
  const ler = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
  assert.strictEqual(ler('.claude/skills/conciliacao-conta-azul/scripts/conciliacao-core.js'), ler('conciliacao/conciliacao-core.js'),
    'Copie conciliacao/conciliacao-core.js para .claude/skills/conciliacao-conta-azul/scripts/');
});

// ---------- DDA ----------
function linhaDigitavel(venc, valor) {
  const dias = Math.round((new Date(venc + 'T00:00:00Z') - Date.UTC(2025, 1, 22)) / 86400000);
  const f5 = String(1000 + dias).padStart(4, '0') + String(Math.round(valor * 100)).padStart(10, '0');
  return `23793.38128 60000.000003 00000.000400 1 ${f5}`;
}

test('dadosLinhaDigitavel decodifica vencimento (fator novo) e valor', () => {
  assert.deepStrictEqual(C.dadosLinhaDigitavel(linhaDigitavel('2026-10-05', 964.62)), { valor: 964.62, vencimento: '2026-10-05' });
  assert.strictEqual(C.dadosLinhaDigitavel('83640000001 1 23450048100 5 00000000000 3 00000000000 0'), null); // convênio
});

test('parseDDA: relatório em tabela', () => {
  const linhas = [
    'Relatório DDA - Boletos  Período: 01/10/2026 a 31/10/2026',
    'Beneficiário  CNPJ  Emissão  Vencimento  Valor (R$)',
    'F F DISTRIBUIDORA DE PRODUTOS LTDA  12.345.678/0001-90  20/09/2026  05/10/2026  964,62',
    'ENEL DISTRIBUICAO SAO PAULO  61.695.227/0001-93  25/09/2026  10/10/2026  1.320,40',
    'ALUGUEIS IMOVEIS SA  11.222.333/0001-44  01/10/2026  15/10/2026  2.500,00',
    'Total  3 boletos  4.785,02'
  ];
  const r = C.parseDDA(linhas);
  assert.strictEqual(r.length, 3);
  assert.deepStrictEqual(r.map(b => [b.beneficiario, b.vencimento, b.valor, b.documento]), [
    ['F F DISTRIBUIDORA DE PRODUTOS LTDA', '2026-10-05', 964.62, '12.345.678/0001-90'],
    ['ENEL DISTRIBUICAO SAO PAULO', '2026-10-10', 1320.4, '61.695.227/0001-93'],
    ['ALUGUEIS IMOVEIS SA', '2026-10-15', 2500, '11.222.333/0001-44']
  ]);
});

test('parseDDA: relatório em blocos com linha digitável', () => {
  const texto = [
    'Beneficiário: F F DISTRIBUIDORA DE PRODUTOS LTDA', 'CNPJ: 12.345.678/0001-90',
    'Vencimento: 05/10/2026', 'Valor: R$ 964,62', 'Linha digitável: ' + linhaDigitavel('2026-10-05', 964.62),
    'Beneficiário: CONTABILIDADE XYZ', 'CNPJ: 99.888.777/0001-66',
    'Linha digitável: ' + linhaDigitavel('2026-10-20', 350)
  ].join('\n');
  const r = C.parseDDA(texto);
  assert.deepStrictEqual(r.map(b => [b.beneficiario, b.vencimento, b.valor]), [
    ['F F DISTRIBUIDORA DE PRODUTOS LTDA', '2026-10-05', 964.62],
    ['CONTABILIDADE XYZ', '2026-10-20', 350]
  ]);
});

test('conferirDDA separa lançado, provável, divergente e falta', () => {
  const boletos = C.parseDDA([
    'F F DISTRIBUIDORA DE PRODUTOS LTDA  05/10/2026  964,62',
    'ENEL DISTRIBUICAO SAO PAULO  10/10/2026  1.320,40',
    'ALUGUEIS IMOVEIS SA  15/10/2026  2.500,00',
    'GRAFICA RAPIDA ME  18/10/2026  410,00',
    'CONTABILIDADE XYZ  20/10/2026  350,00'
  ]);
  const parcelas = [
    { id: 'a', tipo: 'pagar', vencimento: '2026-10-05', valor: 0, total: 964.62, nome: 'F F Distribuidora', status: 'RECEBIDO' }, // já pago
    { id: 'b', tipo: 'pagar', vencimento: '2026-10-11', valor: 1320.4, total: 1320.4, nome: 'Energia', descricao: 'Conta de luz' },
    { id: 'c', tipo: 'pagar', vencimento: '2026-10-15', valor: 2400, total: 2400, nome: 'Alugueis Imoveis', descricao: 'Aluguel' },
    { id: 'd', tipo: 'receber', vencimento: '2026-10-18', valor: 410, total: 410, nome: 'Grafica Rapida' } // a receber não conta
  ];
  const r = Object.fromEntries(C.conferirDDA(boletos, parcelas).map(x => [x.boleto.beneficiario.split(' ')[0], [x.situacao, x.parcela && x.parcela.id]]));
  assert.deepStrictEqual(r, {
    F: ['lancado', 'a'], ENEL: ['provavel', 'b'], ALUGUEIS: ['divergente', 'c'], GRAFICA: ['falta', null], CONTABILIDADE: ['falta', null]
  });
});

test('parseDDA: valor colado na linha digitável na mesma linha da tabela', () => {
  const r = C.parseDDA(['CONTABILIDADE XYZ LTDA  99.888.777/0001-66  05/10/2026  20/10/2026  350,00  ' + linhaDigitavel('2026-10-20', 350)]);
  assert.deepStrictEqual(r.map(b => [b.beneficiario, b.vencimento, b.valor, b.linha.length]), [['CONTABILIDADE XYZ LTDA', '2026-10-20', 350, 47]]);
});

// ---------- pagamento agrupado ----------
test('agrupado: um PIX quita 3 notas do mesmo fornecedor (nome bate)', () => {
  const movs = [{ id: 'm1', data: '2026-10-10', valor: -1500, historico: 'PIX ENVIADO / F F DISTRIBUIDORA DE PRODUTOS' }];
  const parcelas = [
    { id: 'a', tipo: 'pagar', vencimento: '2026-10-05', valor: 500, nome: 'F F Distribuidora de Produtos', descricao: 'NF 1' },
    { id: 'b', tipo: 'pagar', vencimento: '2026-10-10', valor: 600, nome: 'F F Distribuidora de Produtos', descricao: 'NF 2' },
    { id: 'c', tipo: 'pagar', vencimento: '2026-10-12', valor: 400, nome: 'F F Distribuidora de Produtos', descricao: 'NF 3' },
    { id: 'd', tipo: 'pagar', vencimento: '2026-10-10', valor: 1000, nome: 'Outro Fornecedor', descricao: 'X' },
    { id: 'e', tipo: 'pagar', vencimento: '2026-10-10', valor: 500, nome: 'Outro Fornecedor', descricao: 'Y' }
  ];
  const r = C.conciliar(movs, parcelas, { janelaDias: 5 });
  assert.strictEqual(r.pares.length, 1);
  const g = r.pares[0];
  assert.ok(g.grupo);
  assert.deepStrictEqual(g.parcelas.map(p => p.id), ['a', 'b', 'c']);
  assert.strictEqual(g.confianca, 'media');
  assert.strictEqual(g.ajuste, null);
  assert.deepStrictEqual(r.parcelasSemMovimento.map(p => p.id), ['d', 'e']);
  assert.strictEqual(r.semParcela.length, 0);
});

test('agrupado: fornecedor do banco precisa bater com o do Conta Azul', () => {
  const parcelas = [
    { id: 'a', tipo: 'pagar', vencimento: '2026-10-05', valor: 500, nome: 'Alfa Ltda', descricao: '' },
    { id: 'b', tipo: 'pagar', vencimento: '2026-10-06', valor: 250, nome: 'Alfa Ltda', descricao: '' }
  ];
  const agrupa = h => C.conciliar([{ id: 'm', data: '2026-10-06', valor: -750, historico: h }], parcelas).pares;
  assert.strictEqual(agrupa('PIX ENVIADO / BETA SERVICOS').length, 0);      // PIX para outro fornecedor
  assert.strictEqual(agrupa('PAGTO BOLETO').length, 0);                     // banco sem nome: só à mão
  const ok = agrupa('PAG BOLETO ALFA LTDA');                               // nome no histórico do boleto
  assert.deepStrictEqual(ok[0].parcelas.map(p => p.id), ['a', 'b']);
  assert.strictEqual(ok[0].confianca, 'media');
});

test('agrupado: várias combinações possíveis no mesmo fornecedor vêm com confiança baixa', () => {
  const P = (id, v) => ({ id, tipo: 'pagar', vencimento: '2026-10-05', valor: v, nome: 'Alfa Ltda', descricao: '' });
  const r = C.conciliar([{ id: 'm', data: '2026-10-06', valor: -1000, historico: 'PIX ENVIADO / ALFA LTDA' }], [P('a', 500), P('b', 500), P('c', 500)]);
  assert.strictEqual(r.pares[0].confianca, 'baixa');
});

test('agrupado: 1:1 exato tem prioridade e o agrupamento não reaproveita lançamentos', () => {
  const parcelas = [
    { id: 'x', tipo: 'pagar', vencimento: '2026-10-06', valor: 750, nome: 'Alfa Ltda', descricao: '' },
    { id: 'a', tipo: 'pagar', vencimento: '2026-10-05', valor: 500, nome: 'Alfa Ltda', descricao: '' },
    { id: 'b', tipo: 'pagar', vencimento: '2026-10-06', valor: 250, nome: 'Alfa Ltda', descricao: '' }
  ];
  const movs = [
    { id: 'm1', data: '2026-10-06', valor: -750, historico: 'PIX ENVIADO / ALFA LTDA' },
    { id: 'm2', data: '2026-10-06', valor: -750, historico: 'PIX ENVIADO / ALFA LTDA' }
  ];
  const r = C.conciliar(movs, parcelas);
  assert.strictEqual(r.pares.length, 2);
  assert.ok(!r.pares[0].grupo && r.pares[0].parcela.id === 'x');
  assert.deepStrictEqual(r.pares[1].parcelas.map(p => p.id), ['a', 'b']);
});

test('montarGrupo: diferença vira juros/desconto no maior lançamento', () => {
  const g = C.montarGrupo({ id: 'm', data: '2026-10-10', valor: -1012.5 }, [
    { id: 'a', vencimento: '2026-10-05', valor: 300 }, { id: 'b', vencimento: '2026-10-01', valor: 700 }]);
  assert.deepStrictEqual(g.parcelas.map(p => p.id), ['b', 'a']);
  assert.deepStrictEqual(g.ajuste, { tipo: 'juros', valor: 12.5 });
  assert.strictEqual(g.ajusteEm, 'b');
  assert.strictEqual(g.confianca, 'manual');
});

test('agrupado: boleto sem nome no banco usa o fornecedor do comprovante', () => {
  const parcelas = [
    { id: 'a', tipo: 'pagar', vencimento: '2026-10-05', valor: 500, nome: 'F F Distribuidora de Produtos', descricao: 'NF 1' },
    { id: 'b', tipo: 'pagar', vencimento: '2026-10-08', valor: 1000, nome: 'F F Distribuidora de Produtos', descricao: 'NF 2' },
    { id: 'c', tipo: 'pagar', vencimento: '2026-10-08', valor: 1000, nome: 'Alfa Ltda', descricao: 'X' },
    { id: 'd', tipo: 'pagar', vencimento: '2026-10-08', valor: 500, nome: 'Alfa Ltda', descricao: 'Y' }
  ];
  const mov = { id: 'm', data: '2026-10-09', valor: -1500, historico: 'PAGTO BOLETO' };
  const comp = { id: 'k', ...C.dadosComprovante('Data do pagamento: 09/10/2026 Valor pago: R$ 1.500,00',
    'FORNECEDOR F F DISTRIBUIDORA DE PRODUTOS R$ 1.500,00 V 081026.pdf') };
  const mapa = C.comprovantesDosMovimentos([mov], [comp]);
  assert.deepStrictEqual(mapa, { m: 'k' });
  // sem comprovante: não agrupa (dois fornecedores têm 500 + 1000)
  assert.strictEqual(C.conciliar([mov], parcelas).pares.length, 0);
  // com o comprovante: agrupa as notas da F F
  const r = C.conciliar([{ ...mov, textoComprovante: comp.texto }], parcelas);
  assert.deepStrictEqual(r.pares[0].parcelas.map(p => p.id), ['a', 'b']);
});

test('comprovantesDosMovimentos: sem data só liga quando não há ambiguidade', () => {
  const c = [{ id: 'k', valores: [50000], datas: [], vencimentos: [], texto: 'X' }];
  const m = (id, d) => ({ id, data: d, valor: -500, historico: '' });
  assert.deepStrictEqual(C.comprovantesDosMovimentos([m('a', '2026-10-01')], c), { a: 'k' });
  assert.deepStrictEqual(C.comprovantesDosMovimentos([m('a', '2026-10-01'), m('b', '2026-10-02')], c), {});
});

// ---------- casos reais (out/2026): nomes que não têm nada a ver ----------
test('juros/desconto: sobrenome igual ou cidade na descrição não bastam', () => {
  const parcelas = [
    { id: 'mi', tipo: 'pagar', vencimento: '2026-10-21', valor: 194.76, nome: 'michelle souza', descricao: 'Reembolso visita pacientes FAPES uber - pac João Carlos Ribeiro da Costa' },
    { id: 'en', tipo: 'pagar', vencimento: '2026-10-20', valor: 2905.27, nome: 'ENERGISA-MG', descricao: '9/12 - CONTA LUZ NOVA FRIBURGO' }
  ];
  const movs = [
    { id: 'p1', data: '2026-10-21', valor: -200, historico: 'DEBITO TRANSFERENCIA PIX ( DOC.: DEB PIX / SHEILA RODRIGUES DE SOUZA )' },
    { id: 'p2', data: '2026-10-16', valor: -2891.29, historico: 'DEBITO PAGAMENTO PIX ( DOC.: PGTO PIX / MUNICIPIO DE NOVA FRIBURGO )' }
  ];
  const r = C.conciliar(movs, parcelas, { janelaDias: 5 });
  assert.strictEqual(r.pares.length, 0);
  assert.strictEqual(r.semParcela.length, 2);
});

test('nomeForte: precisa de nome e sobrenome; mesmo fornecedor com juros continua sugerido', () => {
  assert.strictEqual(C.nomeForte('sheila rodrigues souza', 'michelle souza'), false);
  assert.strictEqual(C.nomeForte('alana g rodrigues', 'Alana Goncalves Rodrigues'), true);
  assert.strictEqual(C.nomeForte('municipio nova friburgo', 'ENERGISA-MG'), false);
  assert.strictEqual(C.nomeForte('energisa minas gerais', 'ENERGISA-MG'), true);
  const r = C.conciliar([{ id: 'm', data: '2026-10-21', valor: -200, historico: 'DEB PIX / MICHELLE SOUZA' }],
    [{ id: 'mi', tipo: 'pagar', vencimento: '2026-10-21', valor: 194.76, nome: 'michelle souza', descricao: '' }]);
  assert.deepStrictEqual(r.pares.map(p => [p.parcela.id, p.ajuste]), [['mi', { tipo: 'juros', valor: 5.24 }]]);
});

test('comprovante com nome de outra pessoa não é ligado', () => {
  const comp = { id: 'k', ...C.dadosComprovante('', 'ELOA ANDREZA CRISTINA SOUZA NUNES R$ 200,00 PIX ENVIADO - Pagamento curinga - pac Daniel Batista.pdf') };
  const par = { movimento: { id: 'm', data: '2026-10-21', valor: -200, historico: 'DEB PIX / SHEILA RODRIGUES DE SOUZA' },
    parcela: { nome: 'Sheila Rodrigues de Souza', descricao: 'Reembolso', vencimento: '2026-10-21' } };
  assert.deepStrictEqual(C.casarComprovantes([par], [comp]), {});
  const certo = { id: 'k2', ...C.dadosComprovante('', 'SHEILA RODRIGUES DE SOUZA R$ 200,00 PIX ENVIADO - Reembolso.pdf') };
  assert.deepStrictEqual(C.casarComprovantes([par], [comp, certo]), { m: 'k2' });
  // comprovante sem nome (só valor/data) continua valendo
  const semNome = { id: 'k3', ...C.dadosComprovante('', '2026-10-21 200,00.jpg') };
  assert.deepStrictEqual(C.casarComprovantes([par], [semNome]), { m: 'k3' });
});

test('sugestão excluída não volta a ser sugerida (1:1, juros e agrupado)', () => {
  const P = (id, v, nome) => ({ id, tipo: 'pagar', vencimento: '2026-10-10', valor: v, nome, descricao: '' });
  const m = { id: 'm', data: '2026-10-10', valor: -300, historico: 'PIX ENVIADO / ALFA LTDA' };
  const parcelas = [P('x', 300, 'Alfa Ltda'), P('y', 295, 'Alfa Ltda'), P('a', 100, 'Alfa Ltda'), P('b', 200, 'Alfa Ltda')];
  assert.strictEqual(C.conciliar([m], parcelas).pares[0].parcela.id, 'x');
  const r1 = C.conciliar([m], parcelas, { rejeitados: new Set(['m|x']) });
  assert.strictEqual(r1.pares[0].parcela.id, 'y');                      // próxima opção: juros
  const r2 = C.conciliar([m], parcelas, { rejeitados: new Set(['m|x', 'm|y']) });
  assert.deepStrictEqual(r2.pares[0].parcelas.map(p => p.id).sort(), ['a', 'b']); // depois: agrupado
  const r3 = C.conciliar([m], parcelas, { rejeitados: new Set(['m|x', 'm|y', 'm|a']) });
  assert.strictEqual(r3.pares.length, 0);
});

test('lançamentos iguais (mesmo valor, contato e vencimento): avisa e prefere a competência do mês', () => {
  const m = { id: 'm', data: '2026-10-23', valor: -323, historico: 'DEBITO TRANSFERENCIA PIX ( DOC.: DEB PIX / CARLOS ROBERTO DE OLIVEIRA SANTOS )' };
  const P = (id, comp) => ({ id, tipo: 'pagar', vencimento: '2026-10-23', valor: 323, nome: 'Carlos Roberto de Oliveira Santos', descricao: 'PAGAMENTO PLANTÃO EXTRA', competencia: comp });
  const r = C.conciliar([m], [P('ago', '2026-08-01'), P('out', '2026-10-01'), P('set', '2026-09-01')], { janelaDias: 5 });
  assert.strictEqual(r.pares[0].parcela.id, 'out');
  assert.deepStrictEqual(r.pares[0].gemeos.map(x => x.id).sort(), ['ago', 'set']);
  assert.notStrictEqual(r.pares[0].confianca, 'alta'); // não vem marcado: precisa conferir
  // sem gêmeos continua alta
  assert.strictEqual(C.conciliar([m], [P('out', '2026-10-01')], { janelaDias: 5 }).pares[0].confianca, 'alta');
});

test('DDA em tabela com células de várias linhas (Unicred): beneficiário pela coluna, não o pagador', () => {
  const I = (y, x, s) => ({ p: 1, x, y, s });
  const itens = [
    I(571, 104, 'Pagador/Agregado'), I(577, 192, 'CPF/CNPJ'), I(571, 260, 'Documento'), I(571, 333, 'Beneficiário'), I(571, 400, 'Vencimento'), I(571, 464, 'Valor'), I(571, 516, 'Situação'),
    I(525, 104, 'SOS VIDAS RESGATES'), I(530, 192, '13.682.936/0001-'), I(525, 260, '209775'), I(536, 333, 'MTP COMERCIO'), I(525, 333, 'DE PRODUTOS'), I(515, 333, 'PARA'),
    I(525, 400, '24/10/2026'), I(525, 464, 'R$ 4.731,20'), I(525, 516, 'Vencido'),
    I(482, 104, 'SOS VIDA RIO'), I(471, 104, 'ATENDIMENTO DE'), I(487, 333, 'ESPECIFARMA'), I(476, 333, 'COM DE'), I(466, 333, 'MEDICAMENTOS'),
    I(471, 260, '0028794301'), I(471, 400, '24/10/2026'), I(471, 464, 'R$ 682,13'), I(471, 516, 'Vencido')
  ];
  const r = C.parseDDAItens(itens);
  assert.deepStrictEqual(r.map(b => [b.beneficiario, b.documento, b.vencimento, b.valor]), [
    ['MTP COMERCIO DE PRODUTOS PARA', '209775', '2026-10-24', 4731.2],
    ['ESPECIFARMA COM DE MEDICAMENTOS', '0028794301', '2026-10-24', 682.13]]);
  assert.deepStrictEqual(C.parseDDAItens([I(10, 10, 'qualquer coisa')]), []);
});
