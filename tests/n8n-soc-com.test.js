// node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
// Roda o código de um nó Code do n8n com $input e $('Configuração') simulados
function rodar(arquivo, itens, cfg = {}) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'automacoes', 'n8n', arquivo), 'utf8');
  const $input = { first: () => ({ json: itens[0] }), all: () => itens.map(json => ({ json })) };
  const $ = () => ({ first: () => ({ json: cfg }) });
  return new Function('$input', '$', src)($input, $);
}

test('alerta societário: assunto, seções e silêncio quando não há nada', () => {
  const r = { data: '2026-11-19', exigencias: [{ empresa: 'CASH HUNTER', tipo: 'transformacao', motivo: 'doc 3/3', prazo: '2026-11-25', dias_restantes: 6 }],
    parados: [{ empresa: 'Elias', tipo: 'abertura', proxima: 'DARE paga', dias_parado: 12 }], vencimentos: [{ empresa: 'X Ltda', tipo: 'certificado_a1', vencimento: '2026-11-20', dias_restantes: 1 }] };
  const [{ json }] = rodar('alerta-societario.code.js', [r], {});
  assert.ok(json.assunto.includes('1 exigência(s)') && json.assunto.includes('1 parado(s)') && json.assunto.includes('1 vencimento(s)'));
  assert.ok(json.html.includes('CASH HUNTER') && json.html.includes('próxima: DARE paga') && json.html.includes('Certificado A1'));
  assert.deepStrictEqual(rodar('alerta-societario.code.js', [{ data: '2026-11-19', exigencias: [], parados: [], vencimentos: [] }], {}), []);
  assert.strictEqual(rodar('alerta-societario.code.js', [{ data: '2026-11-19' }], { enviar_vazio: true }).length, 1);
});

test('alerta comercial: mensagem pronta de WhatsApp para o retorno', () => {
  const r = { data: '2026-11-19', retornos: [{ nome: 'Empresa Y', etapa: 'proposta', dias_parado: 4, mensal: '850.25', contato: 'Ana Souza', whatsapp: '(19) 99999-0000', motivo: 'retorno da proposta' }],
    pesquisas_sem_resposta: 2, notas_baixas: [{ cliente: 'Z Ltda', nota: 5, comentario: 'demora' }] };
  const [{ json }] = rodar('alerta-comercial.code.js', [r], {});
  assert.ok(json.assunto.startsWith('Comercial: 1 retorno(s)'));
  assert.ok(json.html.includes('https://wa.me/5519999990000?text=') && json.html.includes(encodeURIComponent('Olá, Ana!')));
  assert.ok(json.html.includes('nota 5') && json.html.includes('2 pesquisa(s)'));
});

test('e-mails da Junta: protocolo e evento; e-mails sem relação são descartados', () => {
  const emails = [
    { subject: 'JUCESP - Processo em exigência', text: 'Prezado(a), o protocolo nº 1.234.567/26-8 foi colocado em EXIGÊNCIA. Exigência: No doc. 3/3, vir com os dados da empresa individual.', date: '2026-11-18T10:00:00Z' },
    { subject: 'Processo deferido', text: 'Seu processo de protocolo 2345678/26-1 foi DEFERIDO e registrado.' },
    { subject: 'REDESIM - CNPJ', text: 'Protocolo REDESIM SPN2612345678: a inscrição no CNPJ foi deferida. CNPJ 12.345.678/0001-90 emitido.' },
    { subject: 'Newsletter', text: 'Novidades do mês' },
  ];
  const out = rodar('emails-jucesp.code.js', emails).map(x => x.json);
  assert.strictEqual(out.length, 3);
  assert.deepStrictEqual([out[0].protocolo, out[0].evento, out[0].data], ['1.234.567/26-8', 'exigencia', '2026-11-18']);
  assert.ok(out[0].texto.startsWith('EXIGÊNCIA') || out[0].texto.toLowerCase().startsWith('exigência'));
  assert.ok(out[0].texto.includes('doc. 3/3'));
  assert.deepStrictEqual([out[1].protocolo, out[1].evento], ['2345678/26-1', 'deferido']);
  assert.deepStrictEqual([out[2].protocolo, out[2].evento], ['SPN2612345678', 'cnpj']);
});

test('fluxos gerados estão iguais aos arquivos de código', () => {
  const pares = [['alerta-societario.json', 'Montar e-mail', 'alerta-societario.code.js'], ['alerta-comercial.json', 'Montar e-mail', 'alerta-comercial.code.js'],
    ['emails-jucesp.json', 'Entender o e-mail', 'emails-jucesp.code.js'], ['receber-certificado.json', 'Preparar arquivo', 'receber-certificado.code.js'],
    ['alerta-certificados.json', 'Mensagem do Telegram', 'alerta-certificados-telegram.code.js'], ['alerta-certificados.json', 'Avisos aos clientes', 'alerta-certificados-clientes.code.js']];
  for (const [json, nome, code] of pares) {
    const f = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'automacoes', 'n8n', json), 'utf8'));
    const no = f.nodes.find(n => n.name === nome);
    assert.strictEqual(no.parameters.jsCode, fs.readFileSync(path.join(__dirname, '..', 'automacoes', 'n8n', code), 'utf8'), json + ' desatualizado: rode gerar-fluxos.py');
    Object.keys(f.connections).forEach(origem => assert.ok(f.nodes.some(n => n.name === origem), json + ': ligação de nó inexistente ' + origem));
  }
});

test('certificados: arquivo para a VPS com o mesmo nome; avisos sem expor a senha', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'automacoes', 'n8n', 'receber-certificado.code.js'), 'utf8');
  const nos = { 'Recebe do portal': { body: { arquivo: 'C:\\x\\EMPRESA LTDA - senha 1234.pfx', conteudo: 'AAAA', documento: '11222333000181' } }, 'Configuração': { pasta: '/dados/certificados/' } };
  const [r] = new Function('$', src)(n => ({ first: () => ({ json: nos[n] }) }));
  assert.strictEqual(r.json.caminho, '/dados/certificados/EMPRESA LTDA - senha 1234.pfx');
  assert.strictEqual(r.binary.data.fileName, 'EMPRESA LTDA - senha 1234.pfx');
  nos['Recebe do portal'].body.senha = '1234';
  assert.strictEqual(new Function('$', src)(n => ({ first: () => ({ json: nos[n] }) }))[0].json.arquivo, 'EMPRESA LTDA - senha 1234.pfx'); // senha já no nome: não muda
  nos['Recebe do portal'].body = { arquivo: 'SemSenha.pfx', conteudo: 'AAAA', senha: 'zz' };
  assert.strictEqual(new Function('$', src)(n => ({ first: () => ({ json: nos[n] }) }))[0].json.arquivo, 'SemSenha - senha zz.pfx');
  nos['Configuração'].padrao_nome = '{senha}_{nome}.pfx';
  assert.strictEqual(new Function('$', src)(n => ({ first: () => ({ json: nos[n] }) }))[0].json.arquivo, 'zz_SemSenha.pfx');
  nos['Recebe do portal'].body = { arquivo: '../../etc/passwd.pfx', conteudo: 'AAAA' };
  assert.ok(new Function('$', src)(n => ({ first: () => ({ json: nos[n] }) }))[0].json.caminho.endsWith('/passwd.pfx'));
  const itens = [{ cliente: 'EMPRESA LTDA', cnpj: '11222333000181', vencimento: '2026-12-19', dias_restantes: 30, arquivo: 'EMPRESA - senha 1234.pfx', email_contato: 'c@x.com', contato_nome: 'Ana Lima' },
    { empresa: 'Outra', vencimento: '2026-11-12', dias_restantes: -7 }];
  const [tg] = rodar('alerta-certificados-telegram.code.js', [{ data: '2026-11-19', itens }]);
  assert.ok(tg.json.texto.includes('EMPRESA LTDA') && tg.json.texto.includes('vence em 30') && tg.json.texto.includes('vencido há 7'));
  assert.ok(!tg.json.texto.includes('1234'), 'a senha não pode ir para o Telegram');
  assert.deepStrictEqual(rodar('alerta-certificados-telegram.code.js', [{ data: '2026-11-19', itens: [] }]), []);
  const cl = rodar('alerta-certificados-clientes.code.js', [{ data: '2026-11-19', itens }], { avisar_cliente: true, escritorio: 'JCR' });
  assert.strictEqual(cl.length, 1);
  assert.ok(cl[0].json.mensagem.startsWith('Olá, Ana!') && cl[0].json.assunto.includes('vence em 30 dias'));
  assert.deepStrictEqual(rodar('alerta-certificados-clientes.code.js', [{ itens }], { avisar_cliente: false }), []);
});
