import type { Context } from 'hono'
import { getAnonClient } from '../lib/supabase'
import type { AppEnv } from '../types'

export async function listarFiltrosAcessibilidade(c: Context<AppEnv>) {
  const supabase = getAnonClient(c)

  const { data, error } = await supabase
    .from('filtros_acessibilidade')
    .select('tipo, categoria, codigo, rotulo, ordem')
    .eq('ativo', true)
    .order('ordem', { ascending: true })

  if (error) return c.json({ error: error.message }, 500)

  const recursos_local = (data ?? []).filter((f) => f.tipo === 'recurso_local')
  const necessidades_pessoal = (data ?? []).filter((f) => f.tipo === 'necessidade_pessoal')

  return c.json({ recursos_local, necessidades_pessoal })
}
