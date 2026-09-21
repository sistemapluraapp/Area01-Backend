import type { Context } from 'hono'
import type { AppEnv } from '../types'

export async function obterPerfil(c: Context<AppEnv>) {
  const supabase = c.get('supabase')
  const userId = c.get('userId')

  const { data, error } = await supabase
    .from('usuarios')
    .select('id, cpf, nome, created_at')
    .eq('id', userId)
    .single()

  if (error) return c.json({ error: 'Perfil não encontrado' }, 404)
  return c.json(data)
}

export async function atualizarPerfil(c: Context<AppEnv>) {
  const supabase = c.get('supabase')
  const userId = c.get('userId')
  const body = await c.req.json<{ nome?: string }>().catch(() => null)

  if (!body?.nome) {
    return c.json({ error: 'Campo obrigatório: nome' }, 400)
  }

  const { data, error } = await supabase
    .from('usuarios')
    .update({ nome: body.nome })
    .eq('id', userId)
    .select('id, cpf, nome, created_at')
    .single()

  if (error) return c.json({ error: error.message }, 400)
  return c.json(data)
}
