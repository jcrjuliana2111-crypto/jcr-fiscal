// Nó "Montar e-mail" do fluxo alerta-comercial (n8n, nó Code em modo "Run Once for All Items").
// Recebe o JSON da função alerta_comercial do Supabase e devolve { assunto, html } (ou nada, quando não há o que avisar):
// retornos a fazer no funil (com links prontos de WhatsApp e e-mail), pesquisas sem resposta e notas baixas.
// Este arquivo é a fonte do código colado no nó (gerar-fluxos.py); mantenha os dois iguais.

const r = $input.first().json;
const cfg = $('Configuração').first().json;
const PORTAL = (cfg.portal || 'https://jcrjuliana2111-crypto.github.io/jcr-fiscal/') + 'comercial/';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const data = iso => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');
const reais = v => (v ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) + '/mês' : '');
const zap = w => { const d = String(w || '').replace(/\D/g, ''); return d ? (d.length <= 11 ? '55' + d : d) : ''; };
const MSG = { 'retorno da proposta': 'Olá, {n}! Tudo bem? Conseguiu ver a nossa proposta? Posso esclarecer alguma dúvida?',
  'colher a assinatura do contrato': 'Olá, {n}! Passando para lembrar da assinatura do contrato, assim já começamos a implantação.',
  'enviar a proposta': 'Olá, {n}! Estou finalizando a sua proposta e envio em seguida.', 'qualificar e orçar': 'Olá, {n}! Podemos conversar rapidinho para eu montar a sua proposta?',
  'implantação parada': 'Olá, {n}! Para concluirmos a implantação, ainda faltam alguns documentos. Posso te mandar a lista?' };
const retornos = (r.retornos || []).map(x => {
  const nome = String(x.contato || '').split(' ')[0] || '';
  const texto = (MSG[x.motivo] || 'Olá, {n}!').replace('{n}', nome);
  const w = zap(x.whatsapp);
  const links = [w && `<a href="https://wa.me/${w}?text=${encodeURIComponent(texto)}">WhatsApp</a>`, x.email && `<a href="mailto:${esc(x.email)}?subject=${encodeURIComponent('Proposta')}&body=${encodeURIComponent(texto)}">e-mail</a>`].filter(Boolean).join(' · ');
  return `<tr><td style="padding:7px 10px;border-bottom:1px solid #eee"><b>${esc(x.nome)}</b><br><span style="color:#666;font-size:12px">${esc(x.motivo)} · ${x.dias_parado} dia(s) sem movimento ${reais(x.mensal) ? '· ' + reais(x.mensal) : ''}</span></td><td style="padding:7px 10px;border-bottom:1px solid #eee;white-space:nowrap">${links || '—'}</td></tr>`;
});
const baixas = (r.notas_baixas || []).map(x => `<li><b>${esc(x.cliente)}</b>: nota ${x.nota}${x.comentario ? ' — “' + esc(x.comentario) + '”' : ''}</li>`);
const total = retornos.length + baixas.length + (r.pesquisas_sem_resposta ? 1 : 0);
const assunto = retornos.length ? `Comercial: ${retornos.length} retorno(s) para hoje — ${data(r.data)}` : baixas.length ? `Comercial: ${baixas.length} nota(s) baixa(s) na pesquisa — ${data(r.data)}` : `Comercial em dia — ${data(r.data)}`;
const html = `<div style="font-family:Arial,sans-serif;max-width:720px;color:#111">
  <h2 style="margin:0 0 4px">🎯 Comercial — retornos do dia ${data(r.data)}</h2>
  <p style="color:#666;margin:0 0 10px;font-size:14px">Oportunidades paradas no funil de entrada de clientes, com a mensagem pronta para mandar.</p>
  ${retornos.length ? `<table style="width:100%;border-collapse:collapse;font-size:14px">${retornos.join('')}</table>` : '<p>Nenhum retorno pendente. 🎉</p>'}
  ${baixas.length ? `<h3 style="color:#dc2626;margin:22px 0 6px">Notas baixas na pesquisa de satisfação</h3><ul>${baixas.join('')}</ul><p style="font-size:13px;color:#666">Ligue para o cliente ainda hoje.</p>` : ''}
  ${r.pesquisas_sem_resposta ? `<p style="font-size:13px;color:#666">${r.pesquisas_sem_resposta} pesquisa(s) de satisfação sem resposta há mais de 7 dias.</p>` : ''}
  <p style="margin:26px 0 0"><a href="${PORTAL}" style="background:#f87171;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Abrir a entrada de clientes</a></p>
  <p style="color:#999;font-size:12px;margin-top:20px">Enviado automaticamente pelo n8n.</p></div>`;
// Sem nada pendente, só manda e-mail se a Configuração pedir (enviar_vazio = true)
return !total && !cfg.enviar_vazio ? [] : [{ json: { assunto, html } }];
