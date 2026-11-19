// Edge Function smart-handler — projeto qftusjwnlyjokilcjuzb (Notificações fiscais e obrigações).
//
// Acesso só com login do Portal JCR: a página manda o token da sessão do portal (projeto
// onecnoicxqjhgolqncjj) em Authorization e a função confere esse login no Auth do portal.
// O robô de obrigações (sem login) usa o cabeçalho x-robo-key com a ROBO_KEY dos secrets,
// e só nas ações obr-*. As tabelas ficam fechadas para acesso direto: a função grava e lê
// com a service role.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-action, x-robo-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const SUPA_URL = 'https://qftusjwnlyjokilcjuzb.supabase.co'
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const CLAUDE_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const ROBO_KEY = Deno.env.get('ROBO_KEY') ?? ''

// Auth do Portal JCR (chave publicável: é pública, já está no site)
const PORTAL_URL = 'https://onecnoicxqjhgolqncjj.supabase.co'
const PORTAL_KEY = 'sb_publishable_paOFHdYEcMr7MZdOFx16Lw_sXt0n0-9'

// Tabelas do controle de obrigações (painel obrigacoes.html e robô do Domínio)
const OBR_TABELAS: Record<string, string> = {
  empresas: 'obr_empresas',
  entregas: 'obr_entregas',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// Usuário logado no portal? (token da sessão do Supabase Auth do portal)
async function logado(req: Request): Promise<boolean> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer /i, '')
  if (!token) return false
  const r = await fetch(`${PORTAL_URL}/auth/v1/user`, { headers: { apikey: PORTAL_KEY, Authorization: `Bearer ${token}` } })
  if (!r.ok) return false
  const u = await r.json().catch(() => null)
  return !!(u && u.id)
}

// Comparação em tempo constante para a chave do robô
function mesmaChave(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const action = req.headers.get('x-action') || ''
  const robo = action.startsWith('obr-') && mesmaChave(req.headers.get('x-robo-key') || '', ROBO_KEY)
  if (!robo && !(await logado(req))) return json({ error: 'login necessário' }, 401)

  const auth = { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }

  if (action === 'claude') {
    const body = await req.json()
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': CLAUDE_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(body),
    })
    return new Response(JSON.stringify(await r.json()), { headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  if (action === 'get') {
    const r = await fetch(`${SUPA_URL}/rest/v1/notificacoes_fiscais?order=created_at.desc`, { headers: auth })
    return new Response(JSON.stringify(await r.json()), { headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  if (action === 'upsert') {
    const body = await req.json()
    const r = await fetch(`${SUPA_URL}/rest/v1/notificacoes_fiscais`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify(body),
    })
    return new Response(await r.text() || '{}', { status: r.status, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  if (action === 'delete') {
    const { id } = await req.json()
    const r = await fetch(`${SUPA_URL}/rest/v1/notificacoes_fiscais?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: auth })
    return new Response('{}', { status: r.status, headers: cors })
  }

  if (action === 'upload-pdf') {
    const { id, filename, base64 } = await req.json()
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
    const path = `${id}/${filename}`
    const r = await fetch(`${SUPA_URL}/storage/v1/object/notificacoes-pdf/${path}`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/pdf', 'x-upsert': 'true' },
      body: bytes,
    })
    if (!r.ok) return new Response(await r.text(), { status: r.status, headers: cors })
    const url = `${SUPA_URL}/storage/v1/object/public/notificacoes-pdf/${path}`
    return new Response(JSON.stringify({ url }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // ---------------------------------------------------------------- obrigações
  if (action === 'obr-get' || action === 'obr-upsert' || action === 'obr-delete') {
    const body = await req.json().catch(() => ({}))
    const tabela = OBR_TABELAS[body.tabela]
    if (!tabela) return json({ error: 'tabela inválida' }, 400)

    if (action === 'obr-get') {
      let url = `${SUPA_URL}/rest/v1/${tabela}?order=id&limit=10000`
      if (body.tabela === 'entregas' && body.competencia) url += `&competencia=eq.${encodeURIComponent(body.competencia)}`
      if (body.tabela === 'entregas' && body.empresa_id) url += `&empresa_id=eq.${encodeURIComponent(body.empresa_id)}`
      const r = await fetch(url, { headers: auth })
      return new Response(await r.text(), { status: r.status, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    if (action === 'obr-upsert') {
      const rows: Record<string, unknown>[] = Array.isArray(body.rows) ? body.rows : []
      if (!rows.length) return json({ ok: true, gravados: 0 })
      // PostgREST exige as mesmas colunas em todas as linhas de um upsert em lote
      const grupos = new Map<string, Record<string, unknown>[]>()
      for (const row of rows) {
        const chave = Object.keys(row).sort().join(',')
        grupos.set(chave, [...(grupos.get(chave) ?? []), row])
      }
      for (const lote of grupos.values()) {
        const r = await fetch(`${SUPA_URL}/rest/v1/${tabela}?on_conflict=id`, {
          method: 'POST',
          headers: { ...auth, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(lote),
        })
        if (!r.ok) return new Response(await r.text(), { status: r.status, headers: { ...cors, 'Content-Type': 'application/json' } })
      }
      return json({ ok: true, gravados: rows.length })
    }

    // obr-delete
    if (!body.id) return json({ error: 'id obrigatório' }, 400)
    const r = await fetch(`${SUPA_URL}/rest/v1/${tabela}?id=eq.${encodeURIComponent(body.id)}`, { method: 'DELETE', headers: auth })
    if (!r.ok) return new Response(await r.text(), { status: r.status, headers: cors })
    return json({ ok: true })
  }

  return new Response('not found', { status: 404, headers: cors })
})
