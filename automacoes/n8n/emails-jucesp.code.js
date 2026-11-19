// Nó "Entender o e-mail" do fluxo emails-jucesp (n8n, nó Code em modo "Run Once for All Items").
// Lê um e-mail da JUCESP, do Facilita SP/VRE ou da REDESIM e descobre: número do protocolo e o que aconteceu
// (exigência, indeferimento, deferimento, CNPJ emitido, análise de vício sem pendência).
// Devolve um item { protocolo, evento, texto, data } por e-mail reconhecido; os outros e-mails são descartados.
// Este arquivo é a fonte do código colado no nó (gerar-fluxos.py); mantenha os dois iguais.

function entender(m) {
  const assunto = String(m.subject || m.Subject || '');
  const corpo = String(m.text || m.textPlain || m.snippet || (m.html ? String(m.html).replace(/<[^>]+>/g, ' ') : '') || '').replace(/\s+/g, ' ');
  const tudo = (assunto + ' ' + corpo);
  const sem = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const t = sem(tudo);

  const prot = /protocolo\s*(?:n[º°o.]*|n[uú]mero)?[^0-9a-z]{0,25}((?:[a-z]{2,4})?\s?\d[\d.\-\/ ]{5,24}\d)/i.exec(tudo) || /\b(SP[A-Z]?\d{8,14})\b/.exec(tudo);
  let evento = null;
  if (/indeferid/.test(t)) evento = 'indeferido';
  else if (/exigencia|pendencia|cumprir exig|em exig/.test(t)) evento = 'exigencia';
  else if (/vicio/.test(t) && /(sem|nao ha|nenhum) (vicio|pendencia)|concluid/.test(t)) evento = 'vicio_ok';
  else if (/cnpj (foi )?(gerado|emitido|deferido|inscrito)|inscricao no cnpj/.test(t)) evento = 'cnpj';
  else if (/deferid|registrad[oa] com sucesso|arquivamento|registro (efetuado|concluido)/.test(t)) evento = 'deferido';

  if (!prot || !evento) return null;
  // Trecho da exigência: o que vem depois da palavra "exigência" (até ~400 letras)
  const i = sem(corpo).search(/exigencia|pendencia|motivo/);
  const texto = evento === 'exigencia' || evento === 'indeferido' ? corpo.slice(Math.max(0, i), Math.max(0, i) + 400).trim() : assunto.slice(0, 200);
  const data = m.date ? new Date(m.date).toISOString().slice(0, 10) : null;
  return { protocolo: prot[1].replace(/\s/g, ''), evento, texto, data, assunto };
}

return $input.all().map(i => entender(i.json)).filter(Boolean).map(json => ({ json }));
