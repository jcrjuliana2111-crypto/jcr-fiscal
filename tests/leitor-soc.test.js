// node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const L = require('../societario/leitor-core.js');

const socioVazio = () => ({ nome: '', sexo: 'M', nacionalidade: 'brasileiro', estado_civil: 'solteiro', profissao: '', nascimento: '', rg: '', cpf: '', endereco: '', quotas: null, administrador: false, situacao: 'permanece' });
const dados = (extra = {}) => ({ tipo: 'constituicao', empresa: { nome: '', uf: 'SP', objeto: [], valor_quota: 1 }, socios: [socioVazio()], alteracao: { muda: {} }, ...extra });

test('valores numéricos em formatos diferentes', () => {
  assert.strictEqual(L.numero('10000.00'), 10000);
  assert.strictEqual(L.numero('10.000,00'), 10000);
  assert.strictEqual(L.numero('R$ 1.250,50'), 1250.5);
  assert.strictEqual(L.numero(''), null);
});

test('documento pessoal: preenche o sócio, RG com órgão e nacionalidade no gênero', () => {
  const d = dados();
  const p = L.propostas('pessoal', { tipo_documento: 'CNH', nome: 'BELTRANA  SOUZA', cpf: '111.444.777-35', rg_numero: '2.222.222', rg_orgao: 'SSP', rg_uf: 'SP',
    data_nascimento: '02/02/1985', naturalidade: 'Campinas/SP', nacionalidade: 'BRASILEIRA', sexo: 'F', nome_mae: '', nome_pai: '' }, d, 0);
  const v = Object.fromEntries(p.map(x => [x.caminho, x.novo]));
  assert.strictEqual(v['socios.0.nome'], 'BELTRANA SOUZA');
  assert.strictEqual(v['socios.0.rg'], '2.222.222 SSP/SP');
  assert.strictEqual(v['socios.0.nacionalidade'], 'brasileira');
  assert.strictEqual(v['socios.0.sexo'], 'F');
  assert.ok(p.every(x => x.marcar));
  L.aplicar(d, p);
  assert.strictEqual(d.socios[0].cpf, '111.444.777-35');
});

test('valor já preenchido e diferente vem desmarcado; igual não aparece', () => {
  const d = dados(); d.socios[0].cpf = '529.982.247-25'; d.socios[0].nome = 'Beltrana Souza';
  const p = L.propostas('pessoal', { nome: 'BELTRANA SOUZA', cpf: '111.444.777-35', rg_numero: '', rg_orgao: '', rg_uf: '', data_nascimento: '', naturalidade: '', nacionalidade: '', sexo: '' }, d, 0);
  assert.ok(!p.some(x => x.caminho === 'socios.0.nome'));
  const cpf = p.find(x => x.caminho === 'socios.0.cpf');
  assert.ok(cpf.conflito && !cpf.marcar && cpf.atual === '529.982.247-25');
});

test('comprovante de residência em nome de outra pessoa gera aviso', () => {
  const d = dados(); d.socios[0].nome = 'Fulano de Tal';
  const p = L.propostas('residencia', { titular: 'Maria Pereira', logradouro: 'Rua A', numero: '1', complemento: '', bairro: 'Centro', municipio: 'Campinas', uf: 'sp', cep: '13010-000', data_emissao: '' }, d, 0);
  assert.strictEqual(p[0].novo, 'Rua A, nº 1, Centro, Campinas/SP, CEP 13010-000');
  assert.ok(p[0].aviso.includes('Maria Pereira'));
});

test('IPTU vai para a sede, ou para o novo endereço numa alteração de sede', () => {
  const x = { inscricao_imobiliaria: '3.123.45.678.9012', proprietario: '', logradouro: 'Av Norte Sul', numero: '100', complemento: '', bairro: 'Cambuí', municipio: 'Campinas', uf: 'SP', cep: '13025-000', area_terreno: '300', area_construida: '80', exercicio: '2026' };
  const p = L.propostas('iptu', x, dados());
  assert.ok(p.some(s => s.caminho === 'empresa.iptu' && s.novo === '3.123.45.678.9012'));
  assert.ok(p.some(s => s.caminho === 'empresa.area' && s.novo === '80'));
  const alt = dados({ tipo: 'alteracao', alteracao: { muda: { endereco: true }, endereco_novo: {} } });
  const q = L.propostas('iptu', x, alt);
  assert.ok(q.some(s => s.caminho === 'alteracao.endereco_novo.logradouro'));
  assert.ok(!q.some(s => s.caminho.startsWith('empresa.')));
});

test('contrato anterior: empresa, sócios casados pelo CPF e sócio novo no fim', () => {
  const d = dados({ tipo: 'alteracao' });
  d.socios = [{ ...socioVazio(), nome: 'Fulano de Tal', cpf: '529.982.247-25' }];
  const x = { nome_empresarial: 'Exemplo Serviços Ltda', cnpj: '11.222.333/0001-81', nire: '35200000000', natureza_juridica: 'Sociedade Empresária Limitada', data_inicio: '01/02/2020',
    logradouro: 'Av Norte Sul', numero: '100', complemento: '', bairro: 'Cambuí', municipio: 'Campinas', uf: 'SP', cep: '13025-000',
    objeto: ['Consultoria em gestão empresarial (CNAE 7020-4/00)'], capital: '10.000,00', valor_quota: '1.00', enquadramento: 'ME', administracao: 'isoladamente', foro: 'Campinas/SP', numero_ultima_alteracao: '2',
    socios: [
      { nome: 'BELTRANA SOUZA', nacionalidade: 'brasileira', estado_civil: 'casada', regime_bens: 'comunhão parcial de bens', profissao: 'Administradora', data_nascimento: '02/02/1985', rg: '2.222.222 SSP/SP', cpf: '111.444.777-35', endereco: 'Rua B, 2', quotas: '4000', administrador: false },
      { nome: 'FULANO DE TAL', nacionalidade: 'brasileiro', estado_civil: 'solteiro', regime_bens: '', profissao: 'empresário', data_nascimento: '01/01/1990', rg: '1.111.111 SSP/SP', cpf: '529.982.247-25', endereco: 'Rua A, 1', quotas: '6000', administrador: true },
    ] };
  const p = L.propostas('contrato', x, d);
  const v = Object.fromEntries(p.map(s => [s.caminho, s.novo]));
  assert.strictEqual(v['empresa.capital'], 10000);
  assert.strictEqual(v['numero_alteracao'], '3');
  assert.strictEqual(v['socios.0.quotas'], 6000);          // Fulano reconhecido pelo CPF
  assert.strictEqual(v['socios.0.administrador'], true);
  assert.strictEqual(v['socios.1.nome'], 'BELTRANA SOUZA'); // Beltrana entra como novo
  assert.ok(p.find(s => s.caminho === 'socios.1.nome').socio_novo);
  L.aplicar(d, p, () => socioVazio());
  assert.strictEqual(d.socios.length, 2);
  assert.strictEqual(d.socios[1].profissao, 'administradora');
  assert.strictEqual(d.empresa.objeto.length, 1);
});

test('transformação: nome da empresa individual vai para nome_ei', () => {
  const d = dados({ tipo: 'transformacao' });
  const p = L.propostas('ficha', { nome_empresarial: '12.345.678 FULANO DE TAL', natureza_juridica: 'Empresário (Individual)', cnpj: '12.345.678/0001-00', nire: '', data_inicio: '04/02/2025',
    logradouro: '', numero: '', complemento: '', bairro: '', municipio: '', uf: '', cep: '', objeto: [], capital: '', valor_quota: '', enquadramento: '', administracao: '', foro: '', numero_ultima_alteracao: '', socios: [] }, d);
  assert.ok(p.some(s => s.caminho === 'empresa.nome_ei' && s.novo === '12.345.678 FULANO DE TAL'));
  assert.ok(p.some(s => s.caminho === 'empresa.inicio' && s.novo === '04/02/2025'));
});
