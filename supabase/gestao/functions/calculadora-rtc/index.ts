// Edge Function calculadora-rtc — projeto onecnoicxqjhgolqncjj.
// Ponte entre o portal (usuário logado) e a calculadora oficial da Receita rodando no Render
// (reforma/servidor). A chave do servidor fica só nos secrets: RTC_URL e RTC_CHAVE.
//
// Entrada (POST): { caminho: "regime-geral" | "observabilidade/regime-geral" | "xml/generate?tipo=nfe" | ..., corpo?, metodo?, tipo? }
// Saída: a resposta da calculadora, com o mesmo status.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Só os serviços que o portal usa (cálculo, XML e consultas); nada de administração
const PERMITIDOS = [
  /^regime-geral$/, /^observabilidade\/regime-geral$/, /^observabilidade\/erros\?codigo=[A-Z]{3}-\d{3}$/,
  /^base-calculo\/[a-z-]+$/, /^nfse\/[a-z-]+$/,
  /^xml\/(generate|validate)(\?[a-z=&-]+)?$/,
  /^dados-abertos\/[a-z\-\/]+(\?[\w=&.-]+)?$/,
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer /i, "");
  const { data: { user } } = await supabase.auth.getUser(jwt);
  if (!user) return json({ erro: "Login necessário." }, 401);

  const base = (Deno.env.get("RTC_URL") || "").replace(/\/+$/, "");
  const chave = Deno.env.get("RTC_CHAVE") || "";
  if (!base || !chave) return json({ erro: "nao_configurado" }, 503);

  let pedido: { caminho?: string; corpo?: unknown; metodo?: string; tipo?: string };
  try { pedido = await req.json(); } catch { return json({ erro: "JSON inválido." }, 400); }
  const caminho = String(pedido.caminho || "");
  if (!PERMITIDOS.some((re) => re.test(caminho))) return json({ erro: "Serviço não permitido." }, 400);

  const metodo = pedido.metodo === "GET" ? "GET" : "POST";
  const tipo = pedido.tipo === "xml" ? "application/xml" : "application/json";
  const corpo = metodo === "GET" ? undefined : (typeof pedido.corpo === "string" ? pedido.corpo : JSON.stringify(pedido.corpo ?? {}));
  try {
    // O plano gratuito do Render "dorme": a primeira chamada pode levar até ~1 minuto
    const r = await fetch(`${base}/api/calculadora/${caminho}`, {
      method: metodo,
      headers: { "X-Chave-RTC": chave, ...(corpo !== undefined ? { "Content-Type": tipo } : {}) },
      body: corpo,
      signal: AbortSignal.timeout(110_000),
    });
    return new Response(await r.text(), {
      status: r.status,
      headers: { ...cors, "Content-Type": r.headers.get("Content-Type") || "application/json" },
    });
  } catch (e) {
    const tempo = e instanceof DOMException && e.name === "TimeoutError";
    return json({ erro: tempo ? "acordando" : "fora_do_ar", detalhe: String(e) }, 504);
  }
});
