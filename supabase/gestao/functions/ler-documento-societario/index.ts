// Edge Function ler-documento-societario — projeto onecnoicxqjhgolqncjj.
// Lê um documento enviado ao Painel Societário (pasta privada "societario" do Storage) e devolve
// os campos em JSON fixo, com o Claude. A chave fica só no secret ANTHROPIC_API_KEY do Supabase.
//
// Entrada (POST, usuário logado): { caminho: "<user_id>/<processo_id>/<arquivo>", tipo_doc }
// Saída: { ok: true, dados, modelo } | { ok: false, erro }
// Só abre arquivos da pasta do próprio usuário. Não inventa: campo ausente ou ilegível volta "".
import Anthropic from "npm:@anthropic-ai/sdk@1.10.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// ── esquemas (todos os campos obrigatórios; "" quando não há) ──
const texto = { type: "string" };
const obj = (props: Record<string, unknown>) => ({
  type: "object", properties: props, required: Object.keys(props), additionalProperties: false,
});
const endereco = {
  logradouro: texto, numero: texto, complemento: texto, bairro: texto, municipio: texto, uf: texto, cep: texto,
};
const socio = obj({
  nome: texto, nacionalidade: texto, estado_civil: texto, regime_bens: texto, profissao: texto,
  data_nascimento: texto, rg: texto, cpf: texto, endereco: texto, quotas: texto,
  administrador: { type: "boolean" },
});

const TIPOS: Record<string, { schema: unknown; instrucao: string }> = {
  pessoal: {
    schema: obj({
      tipo_documento: { type: "string", enum: ["RG", "CIN", "CNH", "outro"] },
      nome: texto, cpf: texto, rg_numero: texto, rg_orgao: texto, rg_uf: texto,
      data_nascimento: texto, naturalidade: texto, nacionalidade: texto,
      sexo: { type: "string", enum: ["M", "F", ""] }, nome_mae: texto, nome_pai: texto,
    }),
    instrucao: "Documento de identidade brasileiro (RG, Carteira de Identidade Nacional ou CNH). Em CNH, o RG e o órgão emissor ficam no campo 'Doc. Identidade/Órg. Emissor/UF'. Naturalidade como 'Cidade/UF'. Sexo só se estiver escrito no documento.",
  },
  residencia: {
    schema: obj({ titular: texto, ...endereco, data_emissao: texto }),
    instrucao: "Comprovante de residência (conta de consumo, fatura, correspondência). Titular é a pessoa em nome de quem está a conta.",
  },
  iptu: {
    schema: obj({
      inscricao_imobiliaria: texto, proprietario: texto, ...endereco,
      area_terreno: texto, area_construida: texto, exercicio: texto,
    }),
    instrucao: "Carnê ou notificação de IPTU. Inscrição imobiliária (ou cadastro/código do imóvel) exatamente como impressa. Áreas em m², só o número.",
  },
  empresa: {
    schema: obj({
      nome_empresarial: texto, cnpj: texto, nire: texto, natureza_juridica: texto, data_inicio: texto,
      ...endereco,
      objeto: { type: "array", items: texto },
      capital: texto, valor_quota: texto,
      enquadramento: { type: "string", enum: ["ME", "EPP", ""] },
      administracao: { type: "string", enum: ["isoladamente", "conjuntamente", ""] },
      foro: texto, numero_ultima_alteracao: texto,
      socios: { type: "array", items: socio },
    }),
    instrucao: "Documento de empresa: contrato social, alteração contratual (use o contrato consolidado, se houver, para a situação atual), ficha cadastral da Junta Comercial, requerimento de empresário ou cartão CNPJ. Objeto: uma atividade por item, com o código CNAE se aparecer. Sócios: todos os que constam na situação atual, com as quotas de cada um. 'administrador' = true se o sócio administra a sociedade. Para empresário individual, o titular é o único sócio. numero_ultima_alteracao: o número da alteração contratual deste documento, se for uma alteração.",
  },
};
const TIPO_DOC_PARA_ESQUEMA: Record<string, string> = {
  pessoal: "pessoal", residencia: "residencia", iptu: "iptu",
  contrato: "empresa", ficha: "empresa", cnpj: "empresa", outro: "empresa",
};

const SISTEMA = "Você extrai dados de documentos brasileiros para preencher formulários de registro de empresas na Junta Comercial. " +
  "Copie os dados exatamente como estão no documento, com a mesma grafia (inclusive acentos e abreviações). " +
  "Nunca invente nem deduza: campo ausente, ilegível ou cortado na imagem fica como string vazia. " +
  "Formatos: datas dd/mm/aaaa; CPF 000.000.000-00; CNPJ 00.000.000/0000-00; CEP 00000-000; " +
  "valores e quantidades só com algarismos e ponto decimal, sem separador de milhar (ex.: 10000.00).";

const MIME: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, erro: "Use POST." }, 405);
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer /i, "");
    const { data: { user } } = await supabase.auth.getUser(jwt);
    if (!user) return json({ ok: false, erro: "Login necessário." }, 401);

    const { caminho, tipo_doc } = await req.json();
    const esquema = TIPOS[TIPO_DOC_PARA_ESQUEMA[tipo_doc] || ""];
    if (!esquema) return json({ ok: false, erro: "Tipo de documento desconhecido." }, 400);
    if (typeof caminho !== "string" || !caminho.startsWith(user.id + "/") || caminho.includes("..")) {
      return json({ ok: false, erro: "Arquivo fora da sua pasta." }, 403);
    }
    if (!Deno.env.get("ANTHROPIC_API_KEY")) return json({ ok: false, erro: "sem_chave" }, 503);

    const { data: arquivo, error } = await supabase.storage.from("societario").download(caminho);
    if (error || !arquivo) return json({ ok: false, erro: "Arquivo não encontrado." }, 404);
    const ext = (caminho.split(".").pop() || "").toLowerCase();
    const mime = MIME[ext];
    if (!mime) return json({ ok: false, erro: "Envie PDF, JPG, PNG ou WEBP." }, 400);
    const data = encodeBase64(new Uint8Array(await arquivo.arrayBuffer()));
    const bloco = mime === "application/pdf"
      ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data } }
      : { type: "image" as const, source: { type: "base64" as const, media_type: mime as "image/jpeg" | "image/png" | "image/webp", data } };

    const client = new Anthropic();
    const resposta = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      // se o modelo recusar por política, a API repete no modelo de reserva na mesma chamada
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SISTEMA,
      output_config: { effort: "low", format: { type: "json_schema", schema: esquema.schema as Record<string, unknown> } },
      messages: [{ role: "user", content: [bloco, { type: "text", text: esquema.instrucao + " Extraia os campos do esquema." }] }],
    });

    if (resposta.stop_reason === "refusal") return json({ ok: false, erro: "O documento não pôde ser lido (recusado)." }, 422);
    if (resposta.stop_reason === "max_tokens") return json({ ok: false, erro: "Documento grande demais para ler de uma vez." }, 422);
    for (const b of resposta.content) {
      if (b.type === "text") return json({ ok: true, dados: JSON.parse(b.text), modelo: resposta.model });
    }
    return json({ ok: false, erro: "Resposta sem dados." }, 502);
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 401) return json({ ok: false, erro: "sem_chave" }, 503);
    return json({ ok: false, erro: e instanceof Error ? e.message : String(e) }, 500);
  }
});
