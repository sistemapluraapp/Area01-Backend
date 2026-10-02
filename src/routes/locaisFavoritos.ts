import type { Context } from 'hono'
import type { AppEnv } from '../types'

// Cidades e estados favoritos: a pessoa recebe aviso (sininho e e-mail)
// quando surge novidade nesses locais que combine com as suas necessidades.

const LIMITE_LOCAIS = 50

export async function listarLocaisFavoritos(c: Context<AppEnv>) {
  const supabase = c.get('supabase')
  const [{ data, error }, { data: perfil }] = await Promise.all([
    supabase.from('localidades_favoritas').select('id, pais, uf, cidade, criado_em').order('criado_em', { ascending: false }),
    supabase.from('usuarios').select('avisos_favoritos_email').eq('id', c.get('userId')).maybeSingle(),
  ])
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ locais: data ?? [], avisos_email: perfil?.avisos_favoritos_email ?? true })
}

export async function adicionarLocalFavorito(c: Context<AppEnv>) {
  const supabase = c.get('supabase')
  const body = await c.req.json<{ pais?: string; uf?: string; cidade?: string | null }>().catch(() => null)
  const pais = (body?.pais ?? 'BR').trim().toUpperCase()
  let uf = body?.uf?.trim() ?? ''
  const cidade = body?.cidade?.trim() || null

  if (!/^[A-Z]{2}$/.test(pais)) return c.json({ error: 'País inválido' }, 400)
  if (!uf) return c.json({ error: 'Escolha o estado' }, 400)
  if (pais === 'BR') {
    uf = uf.toUpperCase()
    if (!/^[A-Z]{2}$/.test(uf)) return c.json({ error: 'Estado inválido' }, 400)
  }
  if (uf.length > 60) return c.json({ error: 'Estado deve ter no máximo 60 caracteres' }, 400)
  if (cidade && cidade.length > 100) return c.json({ error: 'Cidade deve ter no máximo 100 caracteres' }, 400)

  const { count } = await supabase.from('localidades_favoritas').select('id', { count: 'exact', head: true })
  if ((count ?? 0) >= LIMITE_LOCAIS) return c.json({ error: `Você pode favoritar até ${LIMITE_LOCAIS} locais` }, 400)

  const { data, error } = await supabase
    .from('localidades_favoritas')
    .insert({ usuario_id: c.get('userId'), pais, uf, cidade })
    .select('id, pais, uf, cidade, criado_em')
    .single()
  if (error) {
    if (error.code === '23505') return c.json({ error: 'Este local já está nos seus favoritos' }, 409)
    return c.json({ error: error.message }, 400)
  }
  return c.json(data, 201)
}

export async function removerLocalFavorito(c: Context<AppEnv>) {
  const { error } = await c.get('supabase').from('localidades_favoritas').delete().eq('id', c.req.param('id') as string)
  if (error) return c.json({ error: error.message }, 400)
  return c.body(null, 204)
}

export async function definirAvisosEmail(c: Context<AppEnv>) {
  const body = await c.req.json<{ ativo?: boolean }>().catch(() => null)
  if (typeof body?.ativo !== 'boolean') return c.json({ error: 'Informe ativo: true ou false' }, 400)
  const { error } = await c.get('supabase').from('usuarios').update({ avisos_favoritos_email: body.ativo }).eq('id', c.get('userId'))
  if (error) return c.json({ error: error.message }, 400)
  return c.json({ avisos_email: body.ativo })
}
