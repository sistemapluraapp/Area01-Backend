import type { Context } from 'hono'
import type { AppEnv } from '../types'
import { getAnonClient } from '../lib/supabase'

// Etapa 9: landing page de plura.app.br (cópia do site do Festival da Primavera).
// Leitura do conteúdo publicado, formulário de interesse, visitas e cliques
// anônimos (sem cookies) e as imagens da biblioteca de mídia (R2, prefixo landing/).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|preview|lighthouse|headless/i
const CAMPOS_PAGINA = 'id, kind, slug, title, category, starts_at, ends_at, location, cover_url, seo, content'

function str(v: unknown, max: number) {
  if (typeof v !== 'string') return null
  const s = v.trim().slice(0, max)
  return s || null
}

function ipDe(c: Context<AppEnv>) {
  return (c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')?.split(',')[0] || '0.0.0.0').trim()
}

// Identificador anônimo que muda todo dia (não permite rastrear pessoas)
async function hashSessao(c: Context<AppEnv>) {
  const dia = new Date().toISOString().slice(0, 10)
  const dado = new TextEncoder().encode(`${ipDe(c)}|${c.req.header('user-agent') ?? ''}|${dia}|plura-landing`)
  const hash = await crypto.subtle.digest('SHA-256', dado)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

function dispositivo(ua: string | null | undefined, largura?: number): 'mobile' | 'tablet' | 'desktop' {
  const u = (ua ?? '').toLowerCase()
  if (/ipad|tablet/.test(u) || (largura && largura >= 700 && largura < 1024 && /mobile|android/.test(u))) return 'tablet'
  if (/mobi|iphone|android/.test(u)) return 'mobile'
  return 'desktop'
}

// GET /landing/site: configurações, página inicial, eventos e itens do menu
export async function landingSite(c: Context<AppEnv>) {
  const db = getAnonClient(c)
  const [{ data: settings }, { data: eventos }, { data: home }] = await Promise.all([
    db.from('landing_site_settings').select('*').eq('id', 1).maybeSingle(),
    db
      .from('landing_pages')
      .select('id, slug, title, category, starts_at, ends_at, location, cover_url, show_in_nav, sort_order')
      .eq('kind', 'evento')
      .order('sort_order', { ascending: true })
      .order('starts_at', { ascending: true, nullsFirst: false }),
    c.req.query('home') ? db.from('landing_pages').select(CAMPOS_PAGINA).eq('kind', 'home').maybeSingle() : Promise.resolve({ data: null }),
  ])
  c.header('Cache-Control', 'public, max-age=60')
  return c.json({ settings, eventos: eventos ?? [], home })
}

// GET /landing/paginas/:slug (eventos e páginas institucionais publicadas)
export async function landingPagina(c: Context<AppEnv>) {
  const slug = (c.req.param('slug') ?? '').toLowerCase()
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return c.json({ error: 'Página não encontrada' }, 404)
  const { data } = await getAnonClient(c).from('landing_pages').select(CAMPOS_PAGINA).eq('slug', slug).neq('kind', 'home').maybeSingle()
  if (!data) return c.json({ error: 'Página não encontrada' }, 404)
  c.header('Cache-Control', 'public, max-age=60')
  return c.json(data)
}

// Limite simples por IP (por instância do Worker): 5 envios em 10 minutos
const envios = new Map<string, number[]>()
function limitado(ip: string) {
  const agora = Date.now()
  const lista = (envios.get(ip) ?? []).filter((t) => agora - t < 10 * 60 * 1000)
  lista.push(agora)
  envios.set(ip, lista)
  if (envios.size > 5000) envios.clear()
  return lista.length > 5
}

// POST /landing/interesse (formulário de interesse)
export async function landingInteresse(c: Context<AppEnv>) {
  const b = await c.req.json<Record<string, unknown>>().catch(() => null)
  if (!b) return c.json({ error: 'Dados inválidos.' }, 400)
  if (b.website) return c.json({ ok: true }) // armadilha anti-robô
  if (limitado(ipDe(c))) return c.json({ error: 'Muitos envios. Tente novamente em alguns minutos.' }, 429)

  const name = str(b.name, 200)
  const email = str(b.email, 320)?.toLowerCase() ?? null
  if (!name) return c.json({ error: 'Informe seu nome.' }, 400)
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: 'Informe um e-mail válido.' }, 400)
  if (b.consent !== true) return c.json({ error: 'É preciso aceitar o uso dos dados (LGPD).' }, 400)

  const utmIn = (b.utm ?? {}) as Record<string, unknown>
  const utm = Object.fromEntries(['source', 'medium', 'campaign'].map((k) => [k, str(utmIn[k], 100)]).filter(([, v]) => v))
  const interests = Array.isArray(b.interests) ? b.interests.map((i) => str(i, 120)).filter(Boolean).slice(0, 30) : []

  const { error } = await getAnonClient(c)
    .from('landing_form_submissions')
    .insert({
      page_id: typeof b.page_id === 'string' && UUID.test(b.page_id) ? b.page_id : null,
      name,
      email,
      phone: str(b.phone, 40),
      city: str(b.city, 120),
      interests,
      heard_from: str(b.heard_from, 200),
      message: str(b.message, 5000),
      consent: true,
      newsletter: b.newsletter === true,
      utm,
      referrer: str(b.referrer, 1000),
    })
  if (error) {
    console.error('landing_form_submissions insert', error)
    return c.json({ error: 'Não foi possível enviar agora. Tente novamente.' }, 500)
  }
  return c.json({ ok: true })
}

// POST /landing/track (visitas e cliques anônimos)
export async function landingTrack(c: Context<AppEnv>) {
  const ua = c.req.header('user-agent')
  if (!ua || BOT.test(ua)) return c.body(null, 204)
  const body = await c.req.text().then((t) => JSON.parse(t) as Record<string, unknown>).catch(() => null)
  if (!body) return c.body(null, 400)
  const pageId = typeof body.page_id === 'string' && UUID.test(body.page_id) ? body.page_id : null
  const path = str(body.path, 500) ?? '/'
  const session_hash = await hashSessao(c)
  const db = getAnonClient(c)

  if (body.t === 'view') {
    const utm = (body.utm ?? {}) as Record<string, unknown>
    let referrer = str(body.referrer, 1000)
    try {
      if (referrer && /(^|\.)plura\.app\.br$/.test(new URL(referrer).hostname)) referrer = null
    } catch {
      referrer = null
    }
    await db.from('landing_page_views').insert({
      page_id: pageId,
      path,
      referrer,
      utm_source: str(utm.source, 100),
      utm_medium: str(utm.medium, 100),
      utm_campaign: str(utm.campaign, 100),
      device: dispositivo(ua, typeof body.w === 'number' ? body.w : undefined),
      session_hash,
    })
  } else if (body.t === 'click') {
    const target = str(body.target, 500)
    if (target) await db.from('landing_click_events').insert({ page_id: pageId, target, label: str(body.label, 200), path, session_hash })
  }
  return c.body(null, 204)
}

// GET /landing/midia/<arquivo> (imagens e PDFs da biblioteca de mídia)
export async function landingMidia(c: Context<AppEnv>) {
  const nome = c.req.path.replace(/^\/landing\/midia\//, '')
  if (!/^[\w.\-/]{1,300}$/.test(nome) || nome.includes('..')) return c.json({ error: 'Arquivo não encontrado' }, 404)
  const objeto = await c.env.CERTIFICACOES.get(`landing/${nome}`)
  if (!objeto) return c.json({ error: 'Arquivo não encontrado' }, 404)
  return new Response(objeto.body, {
    headers: {
      'Content-Type': objeto.httpMetadata?.contentType ?? 'application/octet-stream',
      'Content-Length': String(objeto.size),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
