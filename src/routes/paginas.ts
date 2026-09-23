import type { Context } from 'hono'
import type { AppEnv } from '../types'

// Colunas exibidas nos cards da busca e dos destinos salvos
export const PAGINA_COLUNAS_CARD =
  'id, tipo, nome, subtitulo, descricao_curta, categoria, cidade, uf, logo_url, capa_url, tema, faixa_preco, recursos_acessibilidade, destaques_acessibilidade, created_at'

// Colunas da página pública (sem CNPJ e dados internos)
const PAGINA_COLUNAS_PUBLICAS = [
  'id, tipo, nome, subtitulo, descricao_curta, descricao, slogan, diferencial, categoria, faixa_preco, tags, tema',
  'whatsapp, instagram, website, video_apresentacao',
  'cep, endereco, cidade, uf, complemento, latitude, longitude',
  'ponto_referencia, como_chegar_carro, como_chegar_transporte, rota_acessivel',
  'horarios, feriados, requer_agendamento, tempo_medio, antecedencia',
  'logo_url, capa_url, recursos_acessibilidade, destaques_acessibilidade, observacoes_recursos',
  'antes_de_ir, antes_de_ir_observacoes, seguranca, created_at, updated_at',
].join(', ')

type Nota = { total: number; media: number | null }

// Nota média e total de comentários aprovados por página
async function notasPorPagina(c: Context<AppEnv>, ids: string[]): Promise<Record<string, Nota>> {
  if (ids.length === 0) return {}
  const { data } = await c.get('supabase').from('avaliacoes').select('pagina_id, nota').in('pagina_id', ids).eq('status', 'aprovado')
  const somas: Record<string, { soma: number; total: number }> = {}
  for (const a of data ?? []) {
    somas[a.pagina_id] ??= { soma: 0, total: 0 }
    somas[a.pagina_id].soma += a.nota
    somas[a.pagina_id].total += 1
  }
  return Object.fromEntries(ids.map((id) => [id, somas[id] ? { total: somas[id].total, media: somas[id].soma / somas[id].total } : { total: 0, media: null }]))
}

export async function comNotas<T extends { id: string }>(c: Context<AppEnv>, paginas: T[]) {
  const notas = await notasPorPagina(c, paginas.map((p) => p.id))
  return paginas.map((p) => ({ ...p, nota_media: notas[p.id]?.media ?? null, total_avaliacoes: notas[p.id]?.total ?? 0 }))
}

export async function buscarPaginas(c: Context<AppEnv>) {
  const supabase = c.get('supabase')
  // Remove caracteres com significado na sintaxe de filtro do PostgREST
  const termo = c.req.query('q')?.replace(/[,()*%\\]/g, ' ').trim()
  const categoria = c.req.query('categoria')
  const recursos = c.req.query('recursos')?.split(',').filter(Boolean)

  let query = supabase
    .from('paginas')
    .select(PAGINA_COLUNAS_CARD)
    .eq('suspensa', false)
    .order('created_at', { ascending: false })
    .limit(60)

  if (termo) query = query.or(`nome.ilike.%${termo}%,cidade.ilike.%${termo}%,subtitulo.ilike.%${termo}%`)
  if (categoria) query = query.eq('categoria', categoria)
  if (recursos?.length) query = query.contains('recursos_acessibilidade', recursos)

  const { data, error } = await query
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ resultados: await comNotas(c, data ?? []) })
}

function embaralhar<T>(lista: T[]): T[] {
  const copia = [...lista]
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }
  return copia
}

// "Você também pode gostar": outros empreendimentos com pelo menos um
// recurso de acessibilidade em comum (de qualquer cidade), em ordem
// aleatória. Sem recursos marcados, usa a mesma categoria.
async function recomendacoes(c: Context<AppEnv>, pagina: { id: string; recursos_acessibilidade: string[]; categoria: string | null }) {
  const supabase = c.get('supabase')
  let query = supabase.from('paginas').select(PAGINA_COLUNAS_CARD).eq('suspensa', false).neq('id', pagina.id).limit(40)
  if (pagina.recursos_acessibilidade?.length) query = query.overlaps('recursos_acessibilidade', pagina.recursos_acessibilidade)
  else if (pagina.categoria) query = query.eq('categoria', pagina.categoria)
  const { data } = await query
  return comNotas(c, embaralhar(data ?? []).slice(0, 6))
}

export async function obterPagina(c: Context<AppEnv>) {
  const supabase = c.get('supabase')
  const id = c.req.param('id') as string

  const colunas: string = `${PAGINA_COLUNAS_PUBLICAS}, suspensa`
  const { data, error } = await supabase.from('paginas').select(colunas).eq('id', id).single()
  const pagina = data as unknown as ({ id: string; suspensa: boolean; recursos_acessibilidade: string[]; categoria: string | null } & Record<string, unknown>) | null
  if (error || !pagina || pagina.suspensa) return c.json({ error: 'Página não encontrada' }, 404)
  const { suspensa: _, ...publica } = pagina

  const [{ data: midias }, { data: experiencias }, { data: avaliacoes }, sugeridas] = await Promise.all([
    supabase.from('pagina_midias').select('id, tipo, url, plataforma, formato, categoria, legenda, texto_alt, ordem').eq('pagina_id', id).order('ordem'),
    supabase.from('experiencias').select('*').eq('pagina_id', id).eq('ativo', true).order('ordem'),
    supabase.rpc('avaliacoes_publicas', { p_pagina_id: id }),
    recomendacoes(c, pagina),
  ])

  const lista = (avaliacoes ?? []) as { nota: number }[]
  const media = lista.length ? lista.reduce((s, a) => s + a.nota, 0) / lista.length : null

  return c.json({
    ...publica,
    midias: midias ?? [],
    experiencias: experiencias ?? [],
    avaliacoes: lista,
    nota_media: media,
    total_avaliacoes: lista.length,
    recomendacoes: sugeridas,
  })
}

const MOTIVOS_DENUNCIA = ['recurso_nao_existe', 'acessibilidade_diferente', 'horario_incorreto', 'local_fechado', 'informacao_desatualizada', 'outro']

// "Essa informação está incorreta?" — vai para a fila da Área 04
export async function denunciarInformacao(c: Context<AppEnv>) {
  const supabase = c.get('supabase')
  const userId = c.get('userId')
  const paginaId = c.req.param('id') as string
  const body = await c.req.json<{ motivo?: string; comentario?: string }>().catch(() => null)

  if (!body?.motivo || !MOTIVOS_DENUNCIA.includes(body.motivo)) {
    return c.json({ error: `Campo obrigatório: motivo (${MOTIVOS_DENUNCIA.join(', ')})` }, 400)
  }
  const comentario = body.comentario?.trim().slice(0, 1000) || null
  if (body.motivo === 'outro' && !comentario) return c.json({ error: 'Descreva o problema no comentário' }, 400)

  const { error } = await supabase.from('denuncias_informacao').insert({ pagina_id: paginaId, usuario_id: userId, motivo: body.motivo, comentario })
  if (error) return c.json({ error: error.message }, 400)
  return c.json({ ok: true }, 201)
}
