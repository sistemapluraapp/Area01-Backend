import { createClient } from '@supabase/supabase-js'
import type { Context } from 'hono'
import type { AppEnv } from '../types'

// Cliente anônimo (sem sessão) — usado para signup/login e leitura pública
// (busca de Páginas, avaliações públicas).
export function getAnonClient(c: Context<AppEnv>) {
  return createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  })
}

// Cliente autenticado como o usuário do token — todas as chamadas feitas
// com ele respeitam as políticas de RLS daquele usuário (nunca bypass).
export function getUserClient(c: Context<AppEnv>, accessToken: string) {
  return createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}
