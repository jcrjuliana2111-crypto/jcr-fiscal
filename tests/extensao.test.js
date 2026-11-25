// node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const M = require('../extensao/mapa.js');
const id = (rotulo, contexto = '', extra = {}) => (M.identificar({ rotulo, contexto, ...extra }) || {}).chave;

test('reconhece campos pelo rótulo e pelo bloco (sede x sócio)', () => {
  assert.strictEqual(id('Nome Empresarial:*'), 'empresa.nome');
  assert.strictEqual(id('CPF'), 'socio.cpf');
  assert.strictEqual(id('CEP', 'Endereço do estabelecimento'), 'empresa.cep');
  assert.strictEqual(id('CEP', 'Dados do sócio / integrante — endereço residencial'), 'socio.cep');
  assert.strictEqual(id('Número', 'Localização da sede'), 'empresa.numero');
  assert.strictEqual(id('Inscrição Imobiliária (IPTU)'), 'empresa.iptu');
  assert.strictEqual(id('Área utilizada (m²)'), 'empresa.area');
  assert.strictEqual(id('Data de Nascimento'), 'socio.nascimento');
  assert.strictEqual(id('Órgão Expedidor'), 'socio.rg_orgao');
  assert.strictEqual(id('Estado Civil'), 'socio.estado_civil');
  assert.strictEqual(id('Capital Social (R$)'), 'empresa.capital');
  assert.strictEqual(id('Nome', 'Integrantes'), 'socio.nome');
  assert.strictEqual(id('Data do encerramento'), 'ato.data_encerramento');
  assert.strictEqual(id('Campo sem sentido'), undefined);
});

test('sem rótulo, usa o nome técnico do campo; bloco forçado', () => {
  assert.strictEqual(id('', '', { nome: 'txtCpfSocio' }), 'socio.cpf');
  assert.strictEqual(id('', '', { nome: 'txtObservacao' }), undefined);
  assert.strictEqual(id('', '', { nome: 'cpf' }), 'socio.cpf');
  assert.strictEqual(id('', '', { id: 'cep_estabelecimento' }), 'empresa.cep');
  assert.strictEqual(M.identificar({ rotulo: 'CEP' }, 'socio').chave, 'socio.cep');
  assert.strictEqual(M.identificar({ rotulo: 'CEP' }, 'empresa').chave, 'empresa.cep');
});

test('endereço e RG em partes', () => {
  assert.deepStrictEqual(M.partirEndereco('Rua A, nº 1, apto 2, Centro, Campinas/SP, CEP 13010-000'),
    { cep: '13010-000', municipio: 'Campinas', uf: 'SP', logradouro: 'Rua A', numero: '1', bairro: 'Centro', complemento: 'apto 2' });
  assert.deepStrictEqual(M.partirEndereco('Avenida Brasil, 500, Jardim Paulista, Sumaré/SP, 13170-000'),
    { cep: '13170-000', municipio: 'Sumaré', uf: 'SP', logradouro: 'Avenida Brasil', numero: '500', bairro: 'Jardim Paulista' });
  assert.deepStrictEqual(M.partirRg('1.111.111 SSP/SP'), { numero: '1.111.111', orgao: 'SSP', uf: 'SP' });
});

test('ficha do processo: alteração de endereço usa o novo, CNAEs e sócios', () => {
  const f = M.montarFicha({ empresa: 'Exemplo', tipo: 'alteracao', dados: {
    empresa: { nome: 'Exemplo Serviços Ltda', cnpj: '11.222.333/0001-81', logradouro: 'Rua Velha', numero: '1', municipio: 'Campinas', uf: 'SP', cep: '13000-000', capital: 10000, valor_quota: 1,
      objeto: ['Consultoria em gestão (CNAE 7020-4/00)', 'Treinamento (CNAE 8599-6/04)'] },
    alteracao: { muda: { endereco: true }, endereco_novo: { logradouro: 'Av Nova', numero: '200', bairro: 'Centro', municipio: 'Sumaré', uf: 'SP', cep: '13170-000', iptu: '123' } },
    socios: [{ nome: 'Fulano de Tal', cpf: '529.982.247-25', rg: '1.111.111 SSP/SP', sexo: 'M', estado_civil: 'casado', quotas: 6000, administrador: true, endereco: 'Rua A, nº 1, Centro, Campinas/SP, CEP 13010-000' }] } },
  { email: 'contato@exemplo.com' });
  assert.strictEqual(f.empresa['empresa.logradouro'], 'Av Nova');
  assert.strictEqual(f.empresa['empresa.municipio'], 'Sumaré');
  assert.strictEqual(f.empresa['empresa.capital'], '10.000,00');
  assert.strictEqual(f.empresa['empresa.cnae_principal'], '7020-4/00');
  assert.strictEqual(f.empresa['empresa.cnaes_secundarios'], '8599-6/04');
  assert.strictEqual(f.empresa['empresa.email'], 'contato@exemplo.com');
  assert.strictEqual(f.socios[0]['socio.rg_orgao'], 'SSP');
  assert.strictEqual(f.socios[0]['socio.bairro'], 'Centro');
  assert.strictEqual(f.socios[0]['socio.valor_participacao'], '6.000,00');
  assert.strictEqual(f.socios[0]['socio.administrador'], 'Sim');
  assert.strictEqual(M.valorDe(f, 'socio.cpf', 0), '529.982.247-25');
  assert.strictEqual(M.valorDe(f, 'empresa.cnpj'), '11.222.333/0001-81');
});

test('ajusta o valor ao campo: listas, máscaras e datas', () => {
  const ufs = ['', 'SP', 'RJ', 'MG'].map(v => ({ valor: v, texto: v ? { SP: 'São Paulo', RJ: 'Rio de Janeiro', MG: 'Minas Gerais' }[v] : 'Selecione' }));
  assert.deepStrictEqual(M.ajustarValor('empresa.uf', 'SP', { tipo: 'select', opcoes: ufs }), { opcao: 'SP' });
  const ufsNome = [{ valor: '', texto: 'Selecione' }, { valor: '25', texto: 'São Paulo' }, { valor: '19', texto: 'Rio de Janeiro' }];
  assert.deepStrictEqual(M.ajustarValor('empresa.uf', 'SP', { tipo: 'select', opcoes: ufsNome }), { opcao: '25' });
  assert.deepStrictEqual(M.ajustarValor('socio.uf', 'RJ', { tipo: 'select', opcoes: [{ valor: 'x', texto: 'RJ - Rio de Janeiro' }] }), { opcao: 'x' });
  const ec = [{ valor: '1', texto: 'Solteiro(a)' }, { valor: '2', texto: 'Casado(a)' }, { valor: '3', texto: 'Divorciado(a)' }];
  assert.deepStrictEqual(M.ajustarValor('socio.estado_civil', 'casada', { tipo: 'select', opcoes: ec }), { opcao: '2' });
  assert.deepStrictEqual(M.ajustarValor('socio.sexo', 'Feminino', { tipo: 'select', opcoes: [{ valor: 'M', texto: 'Masculino' }, { valor: 'F', texto: 'Feminino' }] }), { opcao: 'F' });
  assert.deepStrictEqual(M.ajustarValor('socio.cpf', '529.982.247-25', { maxlength: 11 }), { valor: '52998224725' });
  assert.deepStrictEqual(M.ajustarValor('socio.cpf', '529.982.247-25', { maxlength: 14 }), { valor: '529.982.247-25' });
  assert.deepStrictEqual(M.ajustarValor('socio.nascimento', '01/02/1990', { tipo: 'date' }), { valor: '1990-02-01' });
  assert.strictEqual(M.ajustarValor('socio.estado_civil', 'viúvo', { tipo: 'select', opcoes: ec }), null);
});

test('correções de exigência viram chaves corrigidas na ficha', () => {
  assert.deepStrictEqual(M.chavesDoCaminho('socios.1.endereco').chaves.slice(0, 2), ['socio.cep', 'socio.logradouro']);
  assert.strictEqual(M.chavesDoCaminho('socios.1.endereco').socio, 1);
  assert.deepStrictEqual(M.chavesDoCaminho('alteracao.endereco_novo.cep'), { socio: null, chaves: ['empresa.cep'] });
  assert.deepStrictEqual(M.chavesDoCaminho('empresa.nome_ei').chaves, ['empresa.nome']);
  const f = M.montarFicha({ empresa: 'X', tipo: 'abertura', dados: { empresa: { nome: 'X Ltda', logradouro: 'Avenida Brasil' }, socios: [{ nome: 'A', cpf: '111.444.777-35' }, { nome: 'B' }],
    correcoes: { exigencia: 'corrigir', em: '2026-11-25', itens: [{ caminho: 'empresa.logradouro', rotulo: 'Sede — Logradouro', errado: 'Avenida Brazil', certo: 'Avenida Brasil' }, { caminho: 'socios.0.cpf', rotulo: 'CPF', errado: '1', certo: '111.444.777-35' }] } } });
  assert.ok(M.corrigida(f, 'empresa.logradouro') && M.corrigida(f, 'socio.cpf', 0));
  assert.ok(!M.corrigida(f, 'socio.cpf', 1) && !M.corrigida(f, 'empresa.cep'));
  assert.strictEqual(f.correcoes.itens.length, 2);
  assert.strictEqual(M.montarFicha({ dados: { empresa: {} } }).correcoes, null);
});

test('transformação: doc. 3/3 usa os dados do empresário individual', () => {
  const M = require('../extensao/mapa.js');
  const proc = { tipo: 'transformacao', empresa: 'Exemplo Ltda', dados: { empresa: { nome: 'EXEMPLO TECNOLOGIA LTDA', nome_ei: '12.345.678 FULANO DE TAL',
    cnpj: '12.345.678/0001-95', nire: '35100000000', logradouro: 'Rua A', numero: '1', bairro: 'Centro', municipio: 'Sumaré', cep: '13170-000', capital: 1000,
    objeto: ['62.01-5-01 - Desenvolvimento de programas'], enquadramento: 'ME' },
    socios: [{ nome: 'FULANO DE TAL', cpf: '529.982.247-25', endereco: 'Rua A, nº 1, Centro, Sumaré/SP, CEP 13170-000' }] } };
  const f = M.montarFicha(proc);
  assert.strictEqual(f.empresa['empresa.nome'], 'EXEMPLO TECNOLOGIA LTDA');
  const ei = M.fichaDoEmpresario(f);
  assert.strictEqual(ei.empresa['empresa.nome'], '12.345.678 FULANO DE TAL');
  assert.strictEqual(ei.empresa['empresa.nire'], '35100000000');
  assert.ok(!('empresa.capital' in ei.empresa) && !('empresa.enquadramento' in ei.empresa), 'capital e porte da LTDA não vão para o doc. 3/3');
  assert.strictEqual(ei.socios[0]['socio.nome'], 'FULANO DE TAL');
  assert.strictEqual(M.fichaDoEmpresario(M.montarFicha({ ...proc, tipo: 'abertura' })), null);
});
