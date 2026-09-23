import type { Context } from 'hono'
import type { AppEnv } from '../types'

interface NovaAvaliacaoBody {
  nota?: number
  comentario?: string
}

export async function criarAvaliacao(c: Context<AppEnv>) {
  const supabase = c.get('supabase')
  const userId = c.get('userId')
  const paginaId = c.req.param('id')
  const body = await c.req.json<NovaAvaliacaoBody>().catch(() => null)

  const nota = Number(body?.nota)
  const comentario = body?.comentario?.trim().slice(0, 2000) || null
  if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
    return c.json({ error: 'Campo obrigatório: nota (inteiro de 1 a 5)' }, 400)
  }

  const { data, error } = await supabase
    .from('avaliacoes')
    .insert({ pagina_id: paginaId, usuario_id: userId, nota, comentario })
    .select('id, pagina_id, nota, comentario, status, created_at')
    .single()

  if (error) return c.json({ error: error.message }, 400)
  return c.json(data, 201)
}

export async function minhasAvaliacoes(c: Context<AppEnv>) {
  const supabase = c.get('supabase')
  const userId = c.get('userId')

  const { data, error } = await supabase
    .from('avaliacoes')
    .select('id, pagina_id, nota, comentario, status, created_at, paginas(nome)')
    .eq('usuario_id', userId)
    .order('created_at', { ascending: false })

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ avaliacoes: data })
}
