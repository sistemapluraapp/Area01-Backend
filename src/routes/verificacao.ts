import type { Context } from 'hono'
import type { AppEnv } from '../types'
import { getAnonClient } from '../lib/supabase'

// Etapa 8e: verificação pública de certificado pelo código (ex.: PLURA-ABCD-2345)
export async function verificarCertificado(c: Context<AppEnv>) {
  const codigo = (c.req.param('codigo') ?? '').trim().toUpperCase()
  if (!/^PLURA-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(codigo)) return c.json({ error: 'Código inválido. Use o formato PLURA-XXXX-XXXX.' }, 400)
  const { data, error } = await getAnonClient(c).rpc('verificar_certificacao', { p_codigo: codigo }).maybeSingle()
  if (error) return c.json({ error: error.message }, 500)
  if (!data) return c.json({ error: 'Nenhum certificado encontrado com este código.' }, 404)
  return c.json(data)
}
