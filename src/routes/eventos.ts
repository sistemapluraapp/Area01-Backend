import type { Context } from 'hono'
import type { AppEnv } from '../types'

// Eventos públicos (Etapa 7): agenda cultural, eventos da página,
// "Tenho interesse" e "Meus eventos".

const COLUNAS =
  'id, pagina_id, titulo, descricao, imagem_url, link, inicio, fim, local_nome, endereco, pais, uf, cidade, gratuito, acessibilidades, total_interessados, paginas!inner(id, nome, tipo, logo_url, recursos_acessibilidade, suspensa, excluida_em)'

type EventoLinha = { id: string; inicio: string; paginas: { suspensa: boolean; excluida_em: string | null } & Record<string, unknown> } & Record<string, unknown>

async function marcarInteresse(c: Context<AppEnv>, eventos: EventoLinha[]) {
  const userId = c.get('userId')
  const visiveis = eventos.filter((e) => !e.paginas.suspensa && !e.paginas.excluida_em)
  let meus = new Set<string>()
  if (userId && visiveis.length) {
    const { data } = await c.get('supabase').from('evento_interesses').select('evento_id').in('evento_id', visiveis.map((e) => e.id))
    meus = new Set((data ?? []).map((i) => i.evento_id as string))
  }
  return visiveis.map(({ paginas: { suspensa: _, excluida_em: __, ...pagina }, ...e }) => ({ ...e, pagina, interessado: meus.has(e.id) }))
}

// GET /eventos?de=&ate=&pais=&uf=&cidade=&q=&acessibilidade=a,b&gratuito=true
export async function agendaEventos(c: Context<AppEnv>) {
  const q = c.req.query()
  const de = q.de ? new Date(q.de) : new Date(Date.now() - 6 * 3600 * 1000)
  const ate = q.ate ? new Date(q.ate) : new Date(Date.now() + 366 * 24 * 3600 * 1000)
  if (Number.isNaN(de.getTime()) || Number.isNaN(ate.getTime())) return c.json({ error: 'Período inválido' }, 400)

  let consulta = c
    .get('supabase')
    .from('eventos')
    .select(COLUNAS)
    .eq('publicado', true)
    .lte('inicio', ate.toISOString())
    // termina (ou começa, se não tiver término) depois do início do período
    .or(`fim.gte.${de.toISOString()},and(fim.is.null,inicio.gte.${de.toISOString()})`)
    .order('inicio')
    .limit(300)
  if (q.pais && /^[A-Za-z]{2}$/.test(q.pais)) consulta = consulta.eq('pais', q.pais.toUpperCase())
  if (q.uf) consulta = consulta.ilike('uf', q.uf.slice(0, 60))
  if (q.cidade) consulta = consulta.ilike('cidade', q.cidade.slice(0, 100))
  if (q.gratuito === 'true') consulta = consulta.eq('gratuito', true)
  if (q.acessibilidade) consulta = consulta.contains('acessibilidades', q.acessibilidade.split(',').filter(Boolean).slice(0, 20))
  if (q.q) {
    const termo = q.q.slice(0, 80).replace(/[%,()]/g, ' ').trim()
    if (termo) consulta = consulta.or(`titulo.ilike.%${termo}%,local_nome.ilike.%${termo}%,cidade.ilike.%${termo}%`)
  }

  const { data, error } = await consulta
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ eventos: await marcarInteresse(c, (data ?? []) as unknown as EventoLinha[]) })
}

// GET /paginas/:id/eventos — próximos eventos da página
export async function eventosDaPagina(c: Context<AppEnv>) {
  const { data, error } = await c
    .get('supabase')
    .from('eventos')
    .select(COLUNAS)
    .eq('pagina_id', c.req.param('id') as string)
    .eq('publicado', true)
    .or(`fim.gte.${new Date().toISOString()},and(fim.is.null,inicio.gte.${new Date(Date.now() - 6 * 3600 * 1000).toISOString()})`)
    .order('inicio')
    .limit(50)
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ eventos: await marcarInteresse(c, (data ?? []) as unknown as EventoLinha[]) })
}

export async function marcarInteresseEvento(c: Context<AppEnv>) {
  const supabase = c.get('supabase')
  const eventoId = c.req.param('id') as string
  const { data: evento } = await supabase.from('eventos').select('id, publicado').eq('id', eventoId).maybeSingle()
  if (!evento || !evento.publicado) return c.json({ error: 'Evento não encontrado' }, 404)
  const { error } = await supabase.from('evento_interesses').upsert({ evento_id: eventoId, usuario_id: c.get('userId') }, { onConflict: 'evento_id,usuario_id', ignoreDuplicates: true })
  if (error) return c.json({ error: error.message }, 400)
  const { data } = await supabase.from('eventos').select('total_interessados').eq('id', eventoId).single()
  return c.json({ interessado: true, total_interessados: data?.total_interessados ?? 0 })
}

export async function removerInteresseEvento(c: Context<AppEnv>) {
  const supabase = c.get('supabase')
  const eventoId = c.req.param('id') as string
  const { error } = await supabase.from('evento_interesses').delete().eq('evento_id', eventoId).eq('usuario_id', c.get('userId'))
  if (error) return c.json({ error: error.message }, 400)
  const { data } = await supabase.from('eventos').select('total_interessados').eq('id', eventoId).maybeSingle()
  return c.json({ interessado: false, total_interessados: data?.total_interessados ?? 0 })
}

// GET /meus-eventos — eventos em que a pessoa marcou interesse
export async function meusEventos(c: Context<AppEnv>) {
  const { data, error } = await c
    .get('supabase')
    .from('evento_interesses')
    .select(`criado_em, eventos!inner(${COLUNAS})`)
    .eq('usuario_id', c.get('userId'))
    .order('criado_em', { ascending: false })
    .limit(200)
  if (error) return c.json({ error: error.message }, 500)
  const eventos = (data ?? []).map((i) => (i as unknown as { eventos: EventoLinha }).eventos).filter(Boolean)
  const lista = await marcarInteresse(c, eventos)
  return c.json({ eventos: lista.sort((a, b) => String(a.inicio).localeCompare(String(b.inicio))) })
}
