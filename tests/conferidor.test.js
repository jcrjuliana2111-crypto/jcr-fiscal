// node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const C = require('../societario/conferidor-core.js');

// Item do pdf.js: texto na posição (x, y) com fonte de tamanho t
const item = (str, x, y, t = 7) => ({ str, transform: [t, 0, 0, t, x, y], width: str.length * t * 0.5 });

test('linhas mantêm colunas e marcam linhas de rótulos (fonte menor)', () => {
  const txt = C.linhasDePagina([
    item('NOME EMPRESARIAL', 20, 700, 5), item('PORTE', 400, 700, 5),
    item('EXEMPLO LTDA', 20, 690), item('ME', 400, 690),
    item('VALOR DO CAPITAL (R$)', 20, 680, 5),
    item('CODIGO DE ATIVIDADE', 20, 670, 5),
    item('Atividade Principal', 20, 660),
  ]);
  assert.strictEqual(C.campo(txt, 'NOME EMPRESARIAL'), 'EXEMPLO LTDA');
  assert.strictEqual(C.campo(txt, 'PORTE'), 'ME');
  assert.strictEqual(C.campo(txt, 'VALOR DO CAPITAL (R$)'), ''); // próxima linha é rótulo: campo vazio
  assert.strictEqual(C.campo(txt, 'INEXISTENTE'), null);
});

test('CPF e similaridade', () => {
  assert.ok(C.cpfValido('529.982.247-25'));
  assert.ok(!C.cpfValido('529.982.247-24'));
  assert.ok(!C.cpfValido('111.111.111-11'));
  assert.ok(C.sim('FULANO DE TAL', 'FULANO DE TAAL') > 0.9);
});

// Pacote fictício de transformação com os mesmos erros do caso real
const capa = (seq, ato, nome, porte, data) => [
  '                    CAPA DO REQUERIMENTO',
  '⁣   ATO',
  `    ${ato}`,
  '⁣   NOME EMPRESARIAL                                                  PORTE',
  `    ${nome}                                                  ${porte}`,
  '⁣   LOGRADOURO',
  '    Rua das Flores',
  '⁣   NÚMERO EXIGÊNCIA (S)',
  '    1',
  `    NOME: FULANO DE TAL (Administrador)          DARE: R$ ,00          ${seq}`,
  `    ASSINATURA:                          DATA: ${data}          DARF: R$ ,00`,
  '                       SEQ. DOC.',
].join('\n');
const ficha = [
  '    Ficha Cadastral - Modelo 1',
  '   NOME EMPRESARIAL',
  '   EXEMPLO TECNOLOGIA LTDA',
  '   LOGRADOURO (rua, av, etc)',
  '   Rua das Flores',
  '   COMPLEMENTO          BAIRRO/DISTRITO',
  '                        Jardim Primavera',
  '   ATIVIDADE ECONOMICA PRINCIPAL',
  '   6201501 - Desenvolvimento de programas de computador sob encomenda',
  '   DESCRIÇÃO DO OBJETO SOCIAL',
  '   DESENVOLVIMETO DE PROGRAMAS DE COMPUTADOR SOB ENCOMENDA',
  '   DEPENDE DE AUTORIZAÇÃO GOVERNAMENTAL?',
  '   CAPITAL',
  '   Valor do Capital: R$ 10.000,00 - DEZ MIL REAIS',
  '   INICIO DAS ATIVIDADES      TÉRMINO DAS ATIVIDADES     DATA DE ASSINATURA DO DOCUMENTO OU REALIZAÇÃO DA ATA',
  '   01/02/2025                                            10/11/2026',
].join('\n');
const contrato = [
  'TRANSFORMAÇÃO EM SOCIEDADE LIMITADA UNIPESSOAL',
  'FULANO DE TAL, brasileiro, solteiro, nascido em 01/01/1990, inscrito no CPF sob o nº 529.982.247-25,',
  'residente e domiciliado na Rua das Fores, nº 10, Jardim Primavera, Cidade/SP, na qualidade de empresário individual',
  'Cláusula Primeira – Transformar o registro de Empresário Individual em Sociedade Limitada.',
  'Cláusula Terceira – Desenvolvimento de programas de computador sob encomenda (CNAE 6201-',
  '5/01). Cláusula Quinta – O capital social é de R$ 10.000,00 (dez mil reais).',
  'A sociedade iniciou suas atividades em 01/02/2025. Cidade/SP, 10 de novembro de 2026.',
].join('\n');
const requerimento = [
  '   Requerimento de Empresario',
  '⁣   NOME DO EMPRESÁRIO (completo, sem abreviaturas)',
  '   FULANO DE TAL',
  '⁣   ATO(S)',
  '   Cancelamento desta, com transferência de seu acervo para EXEMPLO TECNOLOGIA LTDA;',
  '⁣   NOME EMPRESARIAL                                       PORTE',
  '   EXEMPLO TECNOLOGIA LTDA                                       Normal',
  '⁣   VALOR DO CAPITAL (R$)       VALOR DO CAPITAL (por extenso)',
  '⁣   DATA DE INICIO DAS ATIVIDADES',
].join('\n');
const declaracao = 'Declaração\nEu, FULANO DE TAAL, portador da Cédula de Identidade, declaro… CERTIFICADO DE LICENCIAMENTO INTEGRADO, Rua das Flores';

const pacote = [
  { arquivo: 'capa1.pdf', numero: 1, texto: capa('1/3', 'Constituida por Utilização de Acervo da(s) Empresa(s) N.I.R.E. 3500000000-0.;', 'EXEMPLO TECNOLOGIA LTDA', 'ME', '09/11/2026') },
  { arquivo: 'capa3.pdf', numero: 1, texto: capa('3/3', 'Cancelamento desta, com transferência de seu acervo para EXEMPLO TECNOLOGIA LTDA;', 'EXEMPLO TECNOLOGIA LTDA', 'Normal', '10/11/2026') },
  { arquivo: 'fc.pdf', numero: 1, texto: ficha },
  { arquivo: 'req.pdf', numero: 1, texto: requerimento },
  { arquivo: 'decl.pdf', numero: 1, texto: declaracao },
  { arquivo: 'contrato.pdf', numero: 1, texto: contrato },
];

test('pacote com erros: aponta cada divergência', () => {
  const r = C.analisar(pacote);
  const t = r.achados.map(a => `${a.nivel}: ${a.titulo}`);
  const tem = (nivel, trecho) => assert.ok(t.some(x => x.startsWith(nivel) && x.includes(trecho)), `faltou ${nivel} "${trecho}" em:\n${t.join('\n')}`);
  tem('erro', 'ato de cancelamento com o nome da empresa que recebe o acervo');
  tem('erro', 'Requerimento de empresário com o nome da empresa');
  tem('erro', 'FULANO DE TAAL');
  tem('erro', 'Logradouro escrito de formas diferentes');
  tem('erro', 'Descrição do objeto');
  tem('erro', 'sem profissão');
  tem('atencao', 'campos em branco');
  tem('atencao', 'Capas com datas diferentes');
  tem('atencao', 'desenquadramento do SIMEI');
  tem('ok', 'CNAEs iguais');
  tem('ok', 'Capital igual');
  assert.strictEqual(r.capas.length, 2);
  assert.ok(r.achados.findIndex(a => a.nivel === 'ok') > r.achados.findIndex(a => a.nivel === 'erro'));
});

test('pacote corrigido: sem erros', () => {
  const ok = pacote.map(p => ({ ...p, texto: p.texto
    .replace('FULANO DE TAAL', 'FULANO DE TAL').replace('Fores', 'Flores').replace('DESENVOLVIMETO', 'DESENVOLVIMENTO')
    .replace('solteiro, nascido', 'solteiro, empresário, nascido').replace('09/11/2026', '10/11/2026')
    .replace(/(NOME EMPRESARIAL\s+PORTE\n\s+)EXEMPLO TECNOLOGIA LTDA(\s+)Normal/g, '$1FULANO DE TAL$2ME')
    .replace(/(NOME EMPRESARIAL +PORTE\n +)EXEMPLO TECNOLOGIA LTDA( +)Normal/g, '$1FULANO DE TAL$2ME') }));
  ok.push({ arquivo: 'simei.pdf', numero: 1, texto: 'Termo de desenquadramento do SIMEI' });
  const r = C.analisar(ok);
  const erros = r.achados.filter(a => a.nivel === 'erro').map(a => a.titulo);
  assert.deepStrictEqual(erros, []);
});
