// Nó "Mensagem do Telegram" do fluxo alerta-certificados (n8n, nó Code em modo "Run Once for All Items").
// Recebe o JSON da função certificados_alerta do Supabase e devolve { texto } para o Telegram (HTML),
// (sem o nome do arquivo, que traz a senha), ou nada quando nenhum certificado chegou hoje a um marco (60, 45, 30, 15, 7, 1, 0 dias) nem está vencido.
// Este arquivo é a fonte do código colado no nó (gerar-fluxos.py); mantenha os dois iguais.

const r = $input.first().json;
const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const data = iso => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');
const itens = r.itens || [];
if (!itens.length) return [];
const quando = d => d < 0 ? `⛔ vencido há ${-d} dia(s)` : d === 0 ? '🔴 vence HOJE' : d <= 7 ? `🟠 vence em ${d} dia(s)` : `🟡 vence em ${d} dias`;
const linhas = itens.map(i => `• <b>${esc(i.cliente || i.empresa)}</b> — ${quando(i.dias_restantes)} (${data(i.vencimento)})${i.cnpj ? ` · ${esc(i.cnpj)}` : ''}${i.email_contato || i.whatsapp ? '' : '\n   ⚠️ cliente sem e-mail/WhatsApp no cadastro'}`);
return [{ json: { texto: `🔐 <b>Certificados digitais</b> — ${data(r.data)}\n\n${linhas.join('\n')}\n\nAbra o portal: Painel Societário → Certificados e alvarás.` } }];
