import type { Context } from 'hono'
import type { AppEnv } from '../types'

import { PAGINA_COLUNAS_CARD, comNotas } from './paginas'

export async function listarFavoritos(c: Context<AppEnv>) {
  const supabase = c.get('supabase')
  const userId = c.get('userId')

  const { data, error } = await supabase
    .from('favoritos')
    .select(`id, created_at, paginas(${PAGINA_COLUNAS_CARD})`)
    .eq('usuario_id', userId)
    .order('created_at', { ascending: false })

  if (error) return c.json({ error: error.message }, 500)

  const favoritos = (data ?? []).filter((f) => f.paginas) as unknown as { id: string; created_at: string; paginas: { id: string } }[]
  const paginas = await comNotas(c, favoritos.map((f) => f.paginas))
  return c.json({ favoritos: favoritos.map((f, i) => ({ ...f, paginas: paginas[i] })) })
}

export async function adicionarFavorito(c: Context<AppEnv>) {
  const supabase = c.get('supabase')
  const userId = c.get('userId')
  const paginaId = c.req.param('id') as string

  const { error } = await supabase
    .from('favoritos')
    .upsert({ usuario_id: userId, pagina_id: paginaId }, { onConflict: 'usuario_id,pagina_id' })

  if (error) return c.json({ error: error.message }, 400)
  return c.body(null, 201)
}

export async function removerFavorito(c: Context<AppEnv>) {
  const supabase = c.get('supabase')
  const userId = c.get('userId')
  const paginaId = c.req.param('id') as string

  const { error } = await supabase
    .from('favoritos')
    .delete()
    .eq('usuario_id', userId)
    .eq('pagina_id', paginaId)

  if (error) return c.json({ error: error.message }, 400)
  return c.body(null, 204)
}
