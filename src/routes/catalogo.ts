import type { Context } from 'hono'
import { getAnonClient } from '../lib/supabase'
import type { AppEnv } from '../types'

// Rótulos e ícones do catálogo mantido pela Área 04 (público): categorias,
// tags, itens de "Antes de ir", preferências de turismo e grupos de
// acessibilidade com seus recursos.
export async function listarCatalogo(c: Context<AppEnv>) {
  const supabase = getAnonClient(c)

  const [catalogo, grupos, recursos] = await Promise.all([
    supabase.from('catalogo_itens').select('tipo, codigo, rotulo, icone, ordem').eq('ativo', true).order('ordem'),
    supabase.from('grupos_acessibilidade').select('codigo, rotulo, descricao, icone, ordem').eq('ativo', true).order('ordem'),
    supabase.from('filtros_acessibilidade').select('categoria, codigo, rotulo, icone, descricao, ordem').eq('tipo', 'recurso_local').eq('ativo', true).order('ordem'),
  ])
  const erro = catalogo.error ?? grupos.error ?? recursos.error
  if (erro) return c.json({ error: erro.message }, 500)

  const itens = catalogo.data ?? []
  const porTipo = (tipo: string) => itens.filter((i) => i.tipo === tipo).map(({ tipo: _, ...resto }) => resto)

  c.header('Cache-Control', 'public, max-age=300')
  return c.json({
    categorias: porTipo('categoria'),
    tags: porTipo('tag'),
    antes_de_ir: porTipo('antes_de_ir'),
    preferencias_turismo: porTipo('preferencia_turismo'),
    grupos_acessibilidade: (grupos.data ?? []).map((g) => ({
      ...g,
      recursos: (recursos.data ?? []).filter((r) => r.categoria === g.codigo).map(({ categoria: _, ...resto }) => resto),
    })),
  })
}
