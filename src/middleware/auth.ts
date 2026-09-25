import type { Next } from 'hono'
import type { Context } from 'hono'
import { getAnonClient, getUserClient } from '../lib/supabase'
import type { AppEnv } from '../types'

export async function requireAuth(c: Context<AppEnv>, next: Next) {
  const header = c.req.header('Authorization')
  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: 'Token de autenticação ausente' }, 401)
  }

  const token = header.slice('Bearer '.length)
  const supabase = getUserClient(c, token)
  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user) {
    return c.json({ error: 'Token inválido ou expirado' }, 401)
  }

  c.set('supabase', supabase)
  c.set('userId', data.user.id)
  await next()
}

// Login opcional: visitante sem token navega como anônimo (as políticas do
// banco só liberam o que é público); com token, vale o login normalmente.
export async function optionalAuth(c: Context<AppEnv>, next: Next) {
  if (!c.req.header('Authorization')) {
    c.set('supabase', getAnonClient(c))
    c.set('userId', '')
    return next()
  }
  return requireAuth(c, next)
}
