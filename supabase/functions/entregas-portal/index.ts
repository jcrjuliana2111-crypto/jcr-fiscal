// Portal do cliente do JCR Entregas — projeto onecnoicxqjhgolqncjj, publicada sem verificação de JWT.
// O cliente entra pelo link com o token dele (ent_clientes.portal_token); não há login.
//   GET  ?t=<token>                 → nome do cliente e documentos publicados (sem links)
//   POST {t, id}                    → links assinados (1 h) dos arquivos da entrega e registra a leitura
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function clienteDoToken(t: string | null) {
  if (!t || !UUID.test(t)) return null;
  const { data } = await db.from("ent_clientes").select("cliente_id, user_id, portal_ativo").eq("portal_token", t).maybeSingle();
  return data && data.portal_ativo ? data : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (req.method === "GET") {
      const c = await clienteDoToken(new URL(req.url).searchParams.get("t"));
      if (!c) return json({ erro: "Link inválido ou desativado." }, 404);
      const { data: cli } = await db.from("gclik_clientes").select("razao_social, nome_fantasia, cnpj").eq("id", c.cliente_id).single();
      const desde = new Date(Date.now() - 400 * 864e5).toISOString();
      const { data: entregas } = await db.from("ent_entregas")
        .select("id, nome, departamento, competencia, vencimento, valor, protocolo, enviado_em, lido_em, observacoes, arquivos")
        .eq("cliente_id", c.cliente_id).not("enviado_em", "is", null).gte("enviado_em", desde)
        .order("enviado_em", { ascending: false });
      return json({
        cliente: cli,
        entregas: (entregas || []).map((e) => ({ ...e, arquivos: (e.arquivos || []).map((a: { nome: string }) => ({ nome: a.nome })) })),
      });
    }
    if (req.method === "POST") {
      const { t, id } = await req.json();
      const c = await clienteDoToken(t);
      if (!c || !UUID.test(String(id))) return json({ erro: "Link inválido." }, 404);
      const { data: e } = await db.from("ent_entregas").select("id, user_id, arquivos, lido_em, protocolo")
        .eq("id", id).eq("cliente_id", c.cliente_id).not("enviado_em", "is", null).maybeSingle();
      if (!e) return json({ erro: "Documento não encontrado." }, 404);
      const links = [];
      for (const a of e.arquivos || []) {
        const { data } = await db.storage.from("entregas").createSignedUrl(a.path, 3600, { download: a.nome });
        if (data) links.push({ nome: a.nome, url: data.signedUrl });
      }
      if (!e.lido_em) {
        const agora = new Date().toISOString();
        await db.from("ent_entregas").update({ lido_em: agora }).eq("id", e.id);
        await db.from("ent_historico").insert({ user_id: e.user_id, entrega_id: e.id, acao: "lido", detalhe: "Aberto pelo cliente no portal", autor: "Cliente" });
      }
      return json({ links });
    }
    return json({ erro: "Método não permitido" }, 405);
  } catch (err) {
    return json({ erro: String(err) }, 500);
  }
});
