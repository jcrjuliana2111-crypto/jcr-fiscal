// Nó "Montar e-mail" do fluxo alerta-societario (n8n, nó Code em modo "Run Once for All Items").
// Recebe o JSON da função alerta_societario do Supabase e devolve { assunto, html } (ou nada, quando não há o que avisar).
// Este arquivo é a fonte do código colado no nó (gerar-fluxos.py); mantenha os dois iguais.

const r = $input.first().json;
const cfg = $('Configuração').first().json;
const PORTAL = (cfg.portal || 'https://jcrjuliana2111-crypto.github.io/jcr-fiscal/') + 'societario/';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const data = iso => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');
const TIPO = { abertura: 'Abertura', alteracao: 'Alteração', transformacao: 'Transformação', encerramento: 'Encerramento', baixa: 'Baixa' };
const VENC = { certificado_a1: 'Certificado A1', certificado_a3: 'Certificado A3', alvara: 'Alvará', licenca_sanitaria: 'Licença sanitária', avcb: 'AVCB/CLCB', conselho: 'Conselho de classe', cetesb: 'CETESB', procuracao: 'Procuração eletrônica', outro: 'Outro' };
const prazo = d => d < 0 ? `<b style="color:#dc2626">vencido há ${-d} dia(s)</b>` : d === 0 ? '<b style="color:#d97706">vence hoje</b>' : d <= 10 ? `<b style="color:#d97706">em ${d} dia(s)</b>` : `em ${d} dias`;
const linha = (a, b, c) => `<tr><td style="padding:7px 10px;border-bottom:1px solid #eee"><b>${a}</b></td><td style="padding:7px 10px;border-bottom:1px solid #eee;color:#555">${b}</td><td style="padding:7px 10px;border-bottom:1px solid #eee;white-space:nowrap">${c}</td></tr>`;
const secao = (titulo, cor, linhas) => linhas.length ? `<h3 style="color:${cor};margin:22px 0 6px;font-size:16px">${titulo} (${linhas.length})</h3><table style="width:100%;border-collapse:collapse;font-size:14px">${linhas.join('')}</table>` : '';

const exig = (r.exigencias || []).map(x => linha(esc(x.empresa), `${esc(TIPO[x.tipo] || x.tipo)} · ${esc(x.motivo || '')}${x.responsavel ? ' · ' + esc(x.responsavel) : ''}`, `prazo ${data(x.prazo)} — ${prazo(x.dias_restantes)}`));
const parados = (r.parados || []).map(x => linha(esc(x.empresa), `${esc(TIPO[x.tipo] || x.tipo)}${x.proxima ? ' · próxima: ' + esc(x.proxima) : ''}${x.responsavel ? ' · ' + esc(x.responsavel) : ''}`, `${x.dias_parado} dias parado`));
const venc = (r.vencimentos || []).map(x => linha(esc(x.empresa), `${esc(VENC[x.tipo] || x.tipo)}${x.descricao ? ' · ' + esc(x.descricao) : ''}`, `${data(x.vencimento)} — ${prazo(x.dias_restantes)}`));
const total = exig.length + parados.length + venc.length;
const assunto = total ? `Societário: ${[exig.length && `${exig.length} exigência(s)`, parados.length && `${parados.length} parado(s)`, venc.length && `${venc.length} vencimento(s)`].filter(Boolean).join(', ')} — ${data(r.data)}` : `Societário em dia — ${data(r.data)}`;
const html = `<div style="font-family:Arial,sans-serif;max-width:720px;color:#111">
  <h2 style="margin:0 0 4px">🏛️ Societário — resumo do dia ${data(r.data)}</h2>
  <p style="color:#666;margin:0 0 10px;font-size:14px">Exigências da Junta (prazo de 30 dias para corrigir sem nova taxa), processos sem movimento há mais de 7 dias e certificados/alvarás que vencem nos próximos ${cfg.dias || 30} dias.</p>
  ${secao('Exigências', '#dc2626', exig)}${secao('Processos parados', '#d97706', parados)}${secao('Certificados, alvarás e licenças', '#2563eb', venc)}
  ${!total ? '<p style="font-size:15px">Nada pendente hoje. 🎉</p>' : ''}
  <p style="margin:26px 0 0"><a href="${PORTAL}" style="background:#4f8ef7;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Abrir o Painel Societário</a></p>
  <p style="color:#999;font-size:12px;margin-top:20px">Enviado automaticamente pelo n8n.</p></div>`;
// Sem nada pendente, só manda e-mail se a Configuração pedir (enviar_vazio = true)
return !total && !cfg.enviar_vazio ? [] : [{ json: { assunto, html } }];
