import type { Context } from 'hono'
import { getAnonClient } from '../lib/supabase'
import type { AppEnv } from '../types'

const PAGINA_COLUNAS_PUBLICAS =
  'id, tipo, nome, descricao, categoria, cep, endereco, cidade, uf, complemento, logo_url, capa_url, fotos_urls, recursos_acessibilidade, youtube, instagram, facebook, tiktok, website, created_at'

export async function buscarPaginas(c: Context<AppEnv>) {
  const termo = c.req.query('q')?.trim()
  const supabase = getAnonClient(c)

  let query = supabase
    .from('paginas')
    .select(PAGINA_COLUNAS_PUBLICAS)
    .order('created_at', { ascending: false })
    .limit(50)

  if (termo) {
    query = query.ilike('nome', `%${termo}%`)
  }

  const { data, error } = await query
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ resultados: data })
}

export async function obterPagina(c: Context<AppEnv>) {
  const id = c.req.param('id')
  const supabase = getAnonClient(c)

  const { data: pagina, error } = await supabase
    .from('paginas')
    .select(PAGINA_COLUNAS_PUBLICAS)
    .eq('id', id)
    .single()

  if (error) return c.json({ error: 'Página não encontrada' }, 404)

  const { data: avaliacoes } = await supabase
    .from('avaliacoes')
    .select('id, nota, comentario, resposta, respondido_em, created_at')
    .eq('pagina_id', id)
    .order('created_at', { ascending: false })

  return c.json({ ...pagina, avaliacoes: avaliacoes ?? [] })
}
