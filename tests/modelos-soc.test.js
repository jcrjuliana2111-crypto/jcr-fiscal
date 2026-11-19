// node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const M = require('../societario/modelos-core.js');

const texto = b => (b.partes || []).map(p => (typeof p === 'string' ? p : `[${p.falta}]`)).join('');
const tudo = blocos => blocos.map(texto).join('\n');

const socioA = { nome: 'Fulano de Tal', sexo: 'M', nacionalidade: 'brasileiro', estado_civil: 'solteiro', profissao: 'empresário',
  nascimento: '01/01/1990', rg: '1.111.111 SSP/SP', cpf: '529.982.247-25', endereco: 'Rua A, nº 1, Centro, Campinas/SP, CEP 13010-000',
  quotas: 600, administrador: true, situacao: 'permanece' };
const socioB = { nome: 'Beltrana Souza', sexo: 'F', nacionalidade: 'brasileira', estado_civil: 'casada', regime_bens: 'comunhão parcial de bens',
  profissao: 'administradora', nascimento: '02/02/1985', rg: '2.222.222 SSP/SP', cpf: '111.444.777-35', endereco: 'Rua B, nº 2, Cambuí, Campinas/SP, CEP 13025-000',
  quotas: 400, administrador: false, situacao: 'permanece' };
const empresa = { nome: 'Exemplo Serviços Ltda', cnpj: '11.222.333/0001-81', nire: '35200000000', logradouro: 'Avenida Norte Sul', numero: '100',
  bairro: 'Cambuí', municipio: 'Campinas', uf: 'SP', cep: '13025-000', objeto: ['Consultoria em gestão empresarial (CNAE 7020-4/00)'],
  forma_atuacao: 'em estabelecimento fixo, na sede', capital: 1000, valor_quota: 1, integralizacao: 'imediata', enquadramento: 'ME', foro: 'Campinas/SP' };
const base = { local: 'Campinas/SP', data: '19 de novembro de 2026', numero_alteracao: '3', empresa, socios: [socioA, socioB] };

test('número por extenso e ordinais', () => {
  assert.strictEqual(M.extenso(200000, true), 'duzentas mil');
  assert.strictEqual(M.extenso(1550), 'mil quinhentos e cinquenta');
  assert.strictEqual(M.reaisExtenso(1000000), 'um milhão de reais');
  assert.strictEqual(M.reaisExtenso(1250.5), 'mil duzentos e cinquenta reais e cinquenta centavos');
  assert.strictEqual(M.ordinal(1), 'Primeira');
  assert.strictEqual(M.ordinal(10), 'Décima');
  assert.strictEqual(M.ordinal(13), 'Décima Terceira');
  assert.strictEqual(M.ordinal(21), 'Vigésima Primeira');
});

test('qualificação: profissão, regime de bens e gênero', () => {
  const a = M.qualificacao(socioA).join('');
  assert.ok(a.startsWith('FULANO DE TAL, brasileiro, solteiro, empresário, nascido em 01/01/1990'));
  const b = M.qualificacao(socioB).join('');
  assert.ok(b.includes('casada, sob o regime de comunhão parcial de bens, administradora, nascida em'));
  assert.ok(b.includes('portadora') && b.includes('inscrita no CPF') && b.includes('residente e domiciliada'));
});

test('contrato social com dois sócios: cláusulas obrigatórias, quotas e cláusula adicional', () => {
  const d = { ...base, tipo: 'constituicao', clausulas_adicionais: [{ titulo: 'Da reunião de sócios', texto: 'As reuniões serão convocadas por e-mail.' }] };
  const b = M.gerar(d), t = tudo(b);
  assert.deepStrictEqual(M.faltando(b), []);
  assert.deepStrictEqual(M.validar(d), []);
  assert.ok(t.includes('resolvem constituir uma sociedade limitada'));
  assert.ok(t.includes('O capital social é de R$ 1.000,00 (mil reais), dividido em 1.000 (mil) quotas'));
  assert.ok(t.includes('neste ato, em moeda corrente do País'));
  assert.ok(t.includes('A administração da sociedade caberá ao sócio FULANO DE TAL, isoladamente'));
  assert.ok(t.includes('direito de preferência'));
  assert.ok(t.includes('Falecendo ou sendo interditado'));
  assert.ok(t.includes('não se enquadra em nenhuma das hipóteses de exclusão'));
  assert.ok(t.includes('DA REUNIÃO DE SÓCIOS'));
  assert.ok(t.includes('As reuniões serão convocadas por e-mail.'));
  assert.ok(/Cláusula \S+( \S+)? – Fica eleito o foro da Comarca de Campinas\/SP/.test(t));
  assert.strictEqual(b.filter(x => x.tipo === 'assinatura').length, 2);
  // numeração das cláusulas em sequência, sem pular
  const nums = [...t.matchAll(/Cláusula ([A-ZÀ-ú][a-zà-ú]+(?: [A-ZÀ-ú][a-zà-ú]+)?) –/g)].map(m => m[1]);
  nums.forEach((n, i) => assert.strictEqual(n, M.ordinal(i + 1)));
});

test('validação: quotas que não fecham, CPF inválido, sem administrador e casado sem regime', () => {
  const d = { ...base, tipo: 'constituicao', socios: [{ ...socioA, quotas: 500, cpf: '529.982.247-24', administrador: false }, { ...socioB, regime_bens: '' }] };
  const msgs = M.validar(d).map(x => x.msg).join('\n');
  assert.ok(msgs.includes('não fecha com o capital'));
  assert.ok(msgs.includes('CPF inválido'));
  assert.ok(msgs.includes('Marque pelo menos um sócio como administrador'));
  assert.ok(msgs.includes('regime de bens'));
});

test('alteração: cessão com saída de sócio, entrada, mudança de sede e consolidação', () => {
  const novo = { ...socioB, nome: 'Ciclano Pereira', sexo: 'M', estado_civil: 'solteiro', regime_bens: '', cpf: '111.444.777-35', quotas: 400, situacao: 'entra' };
  const d = { ...base, tipo: 'alteracao', socios: [{ ...socioA }, { ...socioB, quotas: 0, situacao: 'sai' }, novo],
    alteracao: { muda: { socios: true, endereco: true }, endereco_novo: { logradouro: 'Rua Nova', numero: '20', bairro: 'Centro', municipio: 'Campinas', uf: 'SP', cep: '13010-100' },
      cessoes: [{ cedente: 'Beltrana Souza', cessionario: 'Ciclano Pereira', quotas: 400, valor: 400, gratuita: false }], consolidar: true } };
  const b = M.gerar(d), t = tudo(b);
  assert.deepStrictEqual(M.validar(d), []);
  assert.ok(t.startsWith('3ª ALTERAÇÃO CONTRATUAL'));
  assert.ok(t.includes('únicos sócios da sociedade limitada EXEMPLO SERVIÇOS LTDA, com sede na Avenida Norte Sul, nº 100'));
  assert.ok(t.includes('na qualidade de ingressante, CICLANO PEREIRA'));
  assert.ok(t.includes('O sócio BELTRANA SOUZA cede e transfere, a título oneroso, 400 (quatrocentas) quotas'));
  assert.ok(t.includes('ao ingressante CICLANO PEREIRA, pelo preço de R$ 400,00 (quatrocentos reais), retirando-se da sociedade'));
  assert.ok(t.includes('A sede da sociedade é transferida para Rua Nova, nº 20, Centro, Campinas/SP, CEP 13010-100.'));
  assert.ok(t.includes('CONTRATO SOCIAL CONSOLIDADO'));
  // consolidado: sede nova e só os sócios que ficam
  const cons = t.slice(t.indexOf('CONTRATO SOCIAL CONSOLIDADO'));
  assert.ok(cons.includes('A sociedade tem sede na Rua Nova, nº 20'));
  const tabela = b.filter(x => x.tipo === 'tabela').pop();
  assert.deepStrictEqual(tabela.linhas.slice(1, -1).map(l => l[0]), ['FULANO DE TAL', 'CICLANO PEREIRA']);
  // assinam os três (quem sai, quem fica e quem entra)
  assert.strictEqual(b.filter(x => x.tipo === 'assinatura').length, 3);
});

test('alteração: cessionário fora da lista e nada marcado', () => {
  const d = { ...base, tipo: 'alteracao', alteracao: { muda: {}, cessoes: [{ cedente: 'Fulano de Tal', cessionario: 'Desconhecido', quotas: 10 }] } };
  const msgs = M.validar(d).map(x => x.msg).join('\n');
  assert.ok(msgs.includes('Marque o que muda'));
  assert.ok(msgs.includes('Cessionário "Desconhecido" não está na lista'));
});

test('transformação: empresa individual no preâmbulo e contrato consolidado', () => {
  const d = { ...base, tipo: 'transformacao', numero_alteracao: '1', socios: [{ ...socioA, quotas: 1000 }],
    empresa: { ...empresa, nome_ei: '12.345.678 Fulano de Tal', enquadramento: 'ME' } };
  const b = M.gerar(d), t = tudo(b);
  assert.deepStrictEqual(M.faltando(b), []);
  assert.deepStrictEqual(M.validar(d), []);
  assert.ok(t.includes('na qualidade de empresário individual 12.345.678 FULANO DE TAL, com sede na'));
  assert.ok(t.includes('Transformar o registro de Empresário Individual em Sociedade Limitada'));
  assert.ok(t.includes('A sociedade iniciou suas atividades') === false || t.includes('prazo de duração é indeterminado'));
  assert.ok(t.includes('solteiro, empresário, nascido em'));
  assert.ok(t.includes('não responde subsidiariamente pelas obrigações sociais'));
  assert.ok(t.includes('CONTRATO SOCIAL POR TRANSFORMAÇÃO DE EMPRESÁRIO INDIVIDUAL EM SOCIEDADE LIMITADA'));
});

test('distrato: elementos da exigência 26.1', () => {
  const d = { ...base, tipo: 'extincao', distrato: { data_encerramento: '30/11/2026', haveres: 'nao_ha', ativo_passivo: 'Fulano de Tal',
    livros_nome: 'Fulano de Tal', livros_endereco: 'Rua A, nº 1, Centro, Campinas/SP, CEP 13010-000' } };
  const b = M.gerar(d), t = tudo(b);
  assert.deepStrictEqual(M.faltando(b), []);
  assert.ok(t.startsWith('DISTRATO SOCIAL'));
  assert.ok(t.includes('resolvem, de comum acordo, dissolver e liquidar a sociedade'));
  assert.ok(t.includes('encerra suas atividades em 30/11/2026'));
  assert.ok(t.includes('não há bens nem haveres a restituir'));
  assert.ok(t.includes('O ativo e o passivo remanescentes, se vierem a surgir, ficarão sob a responsabilidade de FULANO DE TAL'));
  assert.ok(t.includes('A guarda dos livros e documentos da sociedade ficará a cargo de FULANO DE TAL'));
  assert.strictEqual(b.filter(x => x.tipo === 'assinatura').length, 2);
});

test('campos vazios aparecem como pendências', () => {
  const f = M.faltando(M.gerar({ tipo: 'constituicao', socios: [{}], empresa: {} }));
  ['nome do sócio', 'profissão', 'CPF', 'nome empresarial', 'capital social', 'comarca do foro'].forEach(r => assert.ok(f.includes(r), r));
});

test('cláusula adicional com colchetes pendentes é erro', () => {
  const M2 = require('../societario/modelos-core.js');
  const v = M2.validar({ tipo: 'constituicao', empresa: {}, socios: [], clausulas_adicionais: [{ titulo: 'Da integralização', texto: 'O sócio [NOME] integraliza' }] });
  assert.ok(v.some(x => x.nivel === 'erro' && x.msg.includes('colchetes')));
});
