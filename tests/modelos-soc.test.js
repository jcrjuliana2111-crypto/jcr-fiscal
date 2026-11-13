// node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const M = require('../societario/modelos-core.js');

const texto = b => (b.partes || []).map(p => (typeof p === 'string' ? p : `[${p.falta}]`)).join('');

test('número por extenso', () => {
  assert.strictEqual(M.extenso(200000), 'duzentos mil');
  assert.strictEqual(M.extenso(200000, true), 'duzentas mil');
  assert.strictEqual(M.extenso(1500), 'mil e quinhentos');
  assert.strictEqual(M.extenso(1550), 'mil quinhentos e cinquenta');
  assert.strictEqual(M.extenso(101), 'cento e um');
  assert.strictEqual(M.extenso(2001, true), 'duas mil e uma');
  assert.strictEqual(M.reaisExtenso(200000), 'duzentos mil reais');
  assert.strictEqual(M.reaisExtenso(1), 'um real');
  assert.strictEqual(M.reaisExtenso(1000000), 'um milhão de reais');
  assert.strictEqual(M.reaisExtenso(1250.5), 'mil duzentos e cinquenta reais e cinquenta centavos');
});

test('transformação: empresa individual no preâmbulo e cláusula de transformação', () => {
  const b = M.transformacaoEI({
    numero_alteracao: '1', local: 'Sumaré/SP', data: '13 de novembro de 2026',
    titular: { nome: 'Fulano de Tal', nacionalidade: 'brasileiro', estado_civil: 'solteiro', nascimento: '01/01/1990',
      rg: '1 SSP/SP', cpf: '000.000.000-00', endereco: 'Rua A, 1, Centro, Sumaré/SP, CEP 13.170-000' },
    ei: { nome: '12.345.678 Fulano de Tal', sede: 'Rua A, 1', nire: '35800000000', cnpj: '12.345.678/0001-00' },
    ltda: { nome: 'Exemplo Ltda', capital: 200000, valor_quota: 1, objeto: ['Carga e descarga (CNAE 5212-5/00);', 'Malote'],
      forma_atuacao: 'em estabelecimento fixo', inicio: '01/02/2025', enquadramento: 'ME', foro: 'Sumaré/SP' },
  });
  const txt = b.map(texto);
  assert.ok(txt[3].includes('na qualidade de empresário individual 12.345.678 FULANO DE TAL'));
  assert.ok(txt[3].includes('NIRE 35800000000'));
  assert.ok(txt[4].startsWith('Cláusula Primeira – Transformar o registro de Empresário Individual em Sociedade Limitada'));
  assert.ok(txt.some(t => t.includes('R$ 200.000,00 (duzentos mil reais)') && t.includes('200.000 (duzentas mil) quotas')));
  assert.ok(txt.includes('Carga e descarga (CNAE 5212-5/00);'));
  assert.ok(txt.includes('Malote.'));
  assert.ok(txt.some(t => t.includes('não se enquadra em nenhuma das hipóteses de exclusão')));
  assert.ok(txt.some(t => t.startsWith('Cláusula Décima – Fica eleito o foro da Comarca de Sumaré/SP')));
  assert.deepStrictEqual(M.faltando(b), []);
});

test('campos vazios aparecem como pendências, sem enquadramento a numeração muda', () => {
  const b = M.transformacaoEI({ ltda: { enquadramento: '' } });
  const f = M.faltando(b);
  assert.ok(f.includes('nome empresarial atual (ficha da Junta)'));
  assert.ok(f.includes('CPF'));
  assert.ok(f.includes('capital social'));
  const txt = b.map(texto);
  assert.ok(!txt.some(t => t.includes('MICROEMPRESA')));
  assert.ok(txt.some(t => t.startsWith('Cláusula Oitava – O administrador declara')));
  assert.ok(txt.some(t => t.startsWith('Cláusula Nona – Fica eleito o foro')));
});
