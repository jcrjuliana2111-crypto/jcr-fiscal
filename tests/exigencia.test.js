// node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const E = require('../societario/exigencia-core.js');

const dados = () => ({ tipo: 'abertura', empresa: { nome: 'Exemplo Serviços Ltda', logradouro: 'Avenida Brasil', numero: '500', bairro: 'Centro', municipio: 'Sumaré', uf: 'SP', cep: '13170-000', capital: 50000, objeto: [] },
  socios: [{ nome: 'Fulano de Tal', cpf: '529.982.247-25', rg: '12.345.678-9 SSP/SP', estado_civil: 'solteiro', endereco: 'Rua A, nº 1, Centro, Sumaré/SP, CEP 13171-000' }], alteracao: { muda: {} } });
// o que saiu nos PDFs enviados: logradouro e CPF errados, NIRE que não estava nos dados
const doPdf = { nome_empresarial: 'Exemplo Serviços Ltda', cnpj: '', nire: '35200000000', natureza_juridica: 'Sociedade Empresária Limitada', data_inicio: '', logradouro: 'Avenida Brazil', numero: '500', complemento: '',
  bairro: 'Centro', municipio: 'Sumaré', uf: 'SP', cep: '13170-000', objeto: [], capital: '50000', valor_quota: '', enquadramento: '', administracao: '', foro: '', numero_ultima_alteracao: '',
  socios: [{ nome: 'Fulano de Tal', cpf: '529.982.247-25', rg: '', nacionalidade: '', estado_civil: '', regime_bens: '', profissao: '', data_nascimento: '', endereco: '', quotas: '', administrador: true }] };

test('diferenças: divergente corrige o formulário; dado só no PDF vem para os dados', () => {
  const difs = E.diferencas(dados(), doPdf);
  const logr = difs.find(x => x.caminho === 'empresa.logradouro');
  assert.deepStrictEqual([logr.tipo, logr.escolha, logr.certo, logr.noPdf], ['divergente', 'documento', 'Avenida Brasil', 'Avenida Brazil']);
  const nire = difs.find(x => x.caminho === 'empresa.nire');
  assert.deepStrictEqual([nire.tipo, nire.escolha], ['so_no_pdf', 'pdf']);
  assert.ok(!difs.some(x => x.caminho === 'empresa.cep' || x.caminho === 'socios.0.cpf'), 'iguais não aparecem');
  assert.deepStrictEqual(E.diferencas(dados(), null), []);
});

test('registrar: aplica o que vem do PDF, guarda as correções e as manuais', () => {
  const difs = E.diferencas(dados(), doPdf);
  const r = E.registrar(dados(), difs, [{ caminho: 'socios.0.cpf', rotulo: 'Fulano — CPF', valor: '111.444.777-35' }], 'Corrigir o CPF do sócio e o logradouro conforme o IPTU.', '2026-11-25');
  assert.strictEqual(r.dados.empresa.nire, '35200000000');
  assert.strictEqual(r.dados.empresa.logradouro, 'Avenida Brasil', 'o dado certo não é trocado pelo do PDF');
  assert.strictEqual(r.dados.socios[0].cpf, '111.444.777-35');
  assert.deepStrictEqual(r.correcoes.itens.map(i => [i.caminho, i.errado, i.certo]),
    [['empresa.logradouro', 'Avenida Brazil', 'Avenida Brasil'], ['socios.0.cpf', '529.982.247-25', '111.444.777-35']]);
  assert.strictEqual(r.dados.correcoes.exigencia.startsWith('Corrigir o CPF'), true);
  assert.ok(E.resumo(r.correcoes).includes('era "Avenida Brazil", correto "Avenida Brasil"'));
  // escolher "o PDF está certo" também troca nos dados e não vira correção
  const difs2 = E.diferencas(dados(), doPdf).map(x => x.caminho === 'empresa.logradouro' ? { ...x, escolha: 'pdf' } : x);
  const r2 = E.registrar(dados(), difs2, [], '', '2026-11-25');
  assert.strictEqual(r2.dados.empresa.logradouro, 'Avenida Brazil');
  assert.deepStrictEqual(r2.correcoes.itens, []);
});

test('campos para correção manual incluem os sócios', () => {
  const c = E.camposManuais(dados());
  assert.ok(c.some(x => x.caminho === 'empresa.iptu'));
  assert.ok(c.some(x => x.caminho === 'socios.0.cpf' && x.atual === '529.982.247-25' && x.rotulo.startsWith('Fulano de Tal')));
});
