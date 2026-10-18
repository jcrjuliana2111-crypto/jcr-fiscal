// Nó "Montar e-mail" do fluxo alerta-prazos (n8n, nó Code em modo "Run Once for All Items").
// Recebe o JSON da função alerta_prazos do Supabase e devolve { assunto, html }.
// Este arquivo é a fonte do código colado no nó; mantenha os dois iguais.

const r = $input.first().json;
const cfg = $('Configuração').first().json;
const PORTAL = cfg.portal || 'https://jcrjuliana2111-crypto.github.io/jcr-fiscal/';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const data = iso => iso ? iso.split('-').reverse().join('/') : '';
const reais = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const ICONE = { 'Tarefa': '📝', 'Obrigação': '🧾', 'Entrega': '✅', 'Honorário': '💰' };

function detalhe(i) {
  if (i.tipo === 'Honorário' && i.detalhe) return reais(i.detalhe);
  return i.detalhe || '';
}

function quando(i) {
  const d = i.dias_restantes;
  if (d < 0) return `<span style="color:#dc2626;font-weight:600">${-d} dia${d === -1 ? '' : 's'} de atraso</span>`;
  if (d === 0) return '<span style="color:#d97706;font-weight:600">vence hoje</span>';
  return `em ${d} dia${d === 1 ? '' : 's'}`;
}

function tabela(itens) {
  const linhas = itens.map(i => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;white-space:nowrap">${ICONE[i.tipo] || ''} ${esc(i.tipo)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee"><b>${esc(i.nome)}</b><br><span style="color:#666;font-size:12px">${esc(i.cliente || '—')}${detalhe(i) ? ' · ' + esc(detalhe(i)) : ''}</span></td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;white-space:nowrap">${data(i.vencimento)}<br><span style="font-size:12px">${quando(i)}</span></td>
    </tr>`).join('');
  return `<table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;font-size:14px">${linhas}</table>`;
}

function secao(titulo, cor, itens, limite) {
  if (!itens.length) return '';
  const mostrados = limite ? itens.slice(0, limite) : itens;
  const resto = itens.length - mostrados.length;
  return `
    <h2 style="font-size:15px;margin:26px 0 8px;color:${cor}">${titulo} (${itens.length})</h2>
    ${tabela(mostrados)}
    ${resto > 0 ? `<p style="font-size:13px;color:#666;margin:8px 0 0">…e mais ${resto}. Veja tudo no portal.</p>` : ''}`;
}

const itens = r.itens || [];
const hoje = itens.filter(i => i.grupo === 'hoje');
const proximos = itens.filter(i => i.grupo === 'proximos');
// Atrasados: os mais recentes primeiro (os antigos costumam ser itens não baixados no sistema)
const atrasados = itens.filter(i => i.grupo === 'atrasado').sort((a, b) => b.vencimento.localeCompare(a.vencimento));
const t = r.totais || { atrasado: atrasados.length, hoje: hoje.length, proximos: proximos.length };

const partes = [];
if (t.hoje) partes.push(`${t.hoje} vence${t.hoje === 1 ? '' : 'm'} hoje`);
if (t.proximos) partes.push(`${t.proximos} nos próximos ${r.dias} dias`);
if (t.atrasado) partes.push(`${t.atrasado} atrasado${t.atrasado === 1 ? '' : 's'}`);
const assunto = `Prazos JCR ${data(r.data)}: ${partes.length ? partes.join(' · ') : 'nada pendente'}`;

const card = (n, rotulo, cor) => `
  <td style="padding:12px;border:1px solid #eee;border-radius:10px;text-align:center;width:33%">
    <div style="font-size:24px;font-weight:700;color:${cor}">${n}</div>
    <div style="font-size:12px;color:#666">${rotulo}</div>
  </td>`;

const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:0 auto;color:#111">
  <h1 style="font-size:20px;margin:0 0 4px">Prazos do dia — ${data(r.data)}</h1>
  <p style="color:#666;margin:0 0 18px;font-size:14px">Tarefas, obrigações, entregas e honorários a receber.</p>
  <table cellspacing="8" cellpadding="0" style="width:100%"><tr>
    ${card(t.hoje, 'vencem hoje', '#d97706')}
    ${card(t.proximos, `próximos ${r.dias} dias`, '#2563eb')}
    ${card(t.atrasado, 'atrasados', '#dc2626')}
  </tr></table>
  ${secao('Vencem hoje', '#d97706', hoje)}
  ${secao(`Próximos ${r.dias} dias`, '#2563eb', proximos)}
  ${secao('Atrasados', '#dc2626', atrasados, Number(cfg.limite_atrasados) || 15)}
  ${!itens.length ? '<p style="font-size:15px">Nenhum prazo pendente. 🎉</p>' : ''}
  <p style="margin:28px 0 0"><a href="${PORTAL}" style="background:#4f8ef7;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Abrir o Portal JCR</a></p>
  <p style="color:#999;font-size:12px;margin-top:22px">Enviado automaticamente pelo n8n. Itens concluídos no sistema deixam de aparecer no dia seguinte.</p>
</div>`;

return [{ json: { assunto, html } }];
