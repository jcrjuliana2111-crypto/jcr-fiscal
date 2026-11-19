// Nó "Avisos aos clientes" do fluxo alerta-certificados (n8n, nó Code em modo "Run Once for All Items").
// Um item por cliente com e-mail: { para, assunto, html, whatsapp, mensagem } (o "mensagem" serve para quem
// quiser ligar um nó de WhatsApp depois). Só roda se avisar_cliente = true na Configuração.
// Este arquivo é a fonte do código colado no nó (gerar-fluxos.py); mantenha os dois iguais.

const r = $input.first().json;
const cfg = $('Configuração').first().json;
if (!cfg.avisar_cliente) return [];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const data = iso => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');
const escritorio = cfg.escritorio || 'nosso escritório';
return (r.itens || []).filter(i => i.email_contato && i.dias_restantes >= 0).map(i => {
  const nome = String(i.contato_nome || '').split(' ')[0];
  const prazo = i.dias_restantes === 0 ? 'vence HOJE' : `vence em ${i.dias_restantes} dia(s), no dia ${data(i.vencimento)}`;
  const mensagem = `Olá${nome ? ', ' + nome : ''}! O certificado digital da ${i.cliente || i.empresa} ${prazo}. Sem ele não conseguimos emitir notas nem entregar obrigações. Vamos agendar a renovação? — ${escritorio}`;
  return { json: {
    para: i.email_contato, whatsapp: i.whatsapp || '', mensagem,
    assunto: `Certificado digital da ${i.cliente || i.empresa} ${i.dias_restantes === 0 ? 'vence hoje' : `vence em ${i.dias_restantes} dias`}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;color:#111"><p>${esc(mensagem.replace(/ — .*$/, ''))}</p>
      <p><b>Titular:</b> ${esc(i.titular || i.empresa)}<br><b>Vencimento:</b> ${data(i.vencimento)}</p>
      <p>É só responder este e-mail que agendamos a renovação.</p><p>${esc(escritorio)}</p></div>`,
  } };
});
