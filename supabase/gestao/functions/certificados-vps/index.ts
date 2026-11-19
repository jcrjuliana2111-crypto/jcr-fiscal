// Edge Function certificados-vps — projeto onecnoicxqjhgolqncjj.
// Leva o certificado A1 importado no portal para a VPS do escritório, pelo webhook do n8n que grava
// o arquivo na mesma pasta do robô de notas fiscais (automacoes/n8n/receber-certificado.json).
// Endereço e chave do webhook ficam só nos secrets: N8N_CERT_URL e N8N_CERT_CHAVE.
//
// Entrada (POST, usuário logado): { arquivo, conteudo (base64 do .pfx), senha, documento, titular, vencimento, emitido_em }
// Saída: { ok: true } | { ok: false, erro }
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, erro: "Use POST." }, 405);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer /i, "");
  const { data: { user } } = await supabase.auth.getUser(jwt);
  if (!user) return json({ ok: false, erro: "Login necessário." }, 401);

  const url = Deno.env.get("N8N_CERT_URL") || "", chave = Deno.env.get("N8N_CERT_CHAVE") || "";
  if (!url || !chave) return json({ ok: false, erro: "nao_configurado" }, 503);

  let c: Record<string, unknown>;
  try { c = await req.json(); } catch { return json({ ok: false, erro: "JSON inválido." }, 400); }
  const arquivo = String(c.arquivo || "").replace(/^.*[\\/]/, "").trim();
  const conteudo = String(c.conteudo || "");
  if (!/\.(pfx|p12)$/i.test(arquivo) || arquivo.includes("..")) return json({ ok: false, erro: "Arquivo deve ser .pfx ou .p12." }, 400);
  if (!conteudo || conteudo.length > 300_000 || !/^[A-Za-z0-9+/=]+$/.test(conteudo)) return json({ ok: false, erro: "Conteúdo do certificado inválido." }, 400);

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Chave-JCR": chave },
      body: JSON.stringify({ arquivo, conteudo, senha: String(c.senha ?? ""), documento: String(c.documento || ""), titular: String(c.titular || ""),
        vencimento: c.vencimento || null, emitido_em: c.emitido_em || null, enviado_por: user.email }),
      signal: AbortSignal.timeout(30_000),
    });
    const texto = await r.text();
    if (!r.ok) return json({ ok: false, erro: `VPS respondeu ${r.status}: ${texto.slice(0, 200)}` }, 502);
    return json({ ok: true, vps: texto.slice(0, 500) });
  } catch (e) {
    return json({ ok: false, erro: "VPS fora do ar: " + String(e) }, 504);
  }
});
