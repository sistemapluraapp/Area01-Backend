import type { Context } from 'hono'
import { getAnonClient } from '../lib/supabase'
import type { AppEnv } from '../types'

const EXTENSOES_VALIDAS = ['jpg', 'jpeg', 'png', 'webp'] as const

const TAMANHO_MAXIMO_AVATAR = 5 * 1024 * 1024

export async function obterPerfil(c: Context<AppEnv>) {
  const supabase = c.get('supabase')
  const userId = c.get('userId')

  const { data, error } = await supabase
    .from('usuarios')
    .select(
      'id, cpf, nome, nome_social, avatar_url, cep, endereco, cidade, uf, complemento, necessidades_acessibilidade, preferencias_turismo, created_at'
    )
    .eq('id', userId)
    .single()

  if (error) return c.json({ error: 'Perfil não encontrado' }, 404)

  const [{ count: paginasAdministradas }, { count: colaboracoes }] = await Promise.all([
    supabase
      .from('vinculos')
      .select('id', { count: 'exact', head: true })
      .eq('usuario_id', userId)
      .eq('papel', 'administrador'),
    supabase
      .from('vinculos')
      .select('id', { count: 'exact', head: true })
      .eq('usuario_id', userId)
      .eq('papel', 'colaborador'),
  ])

  return c.json({
    ...data,
    paginas_administradas: paginasAdministradas ?? 0,
    colaboracoes: colaboracoes ?? 0,
  })
}

interface AtualizarPerfilBody {
  nome?: string
  nome_social?: string | null
  cep?: string | null
  endereco?: string | null
  cidade?: string | null
  uf?: string | null
  complemento?: string | null
  necessidades_acessibilidade?: string[]
  preferencias_turismo?: string[]
}

export async function atualizarPerfil(c: Context<AppEnv>) {
  const supabase = c.get('supabase')
  const userId = c.get('userId')
  const body = await c.req.json<AtualizarPerfilBody>().catch(() => null)

  if (!body?.nome) {
    return c.json({ error: 'Campo obrigatório: nome' }, 400)
  }

  if (body.necessidades_acessibilidade !== undefined) {
    if (!Array.isArray(body.necessidades_acessibilidade)) {
      return c.json({ error: 'Campo necessidades_acessibilidade deve ser um array' }, 400)
    }

    const anon = getAnonClient(c)
    const { data: validas, error: erroValidas } = await anon
      .from('filtros_acessibilidade')
      .select('codigo')
      .eq('tipo', 'necessidade_pessoal')

    if (erroValidas) return c.json({ error: erroValidas.message }, 500)

    const codigosValidos = new Set((validas ?? []).map((f) => f.codigo))
    const valido = body.necessidades_acessibilidade.every((item) => codigosValidos.has(item))
    if (!valido) {
      return c.json(
        { error: 'Campo necessidades_acessibilidade contém valores inválidos' },
        400
      )
    }
  }

  if (body.preferencias_turismo !== undefined) {
    if (!Array.isArray(body.preferencias_turismo)) {
      return c.json({ error: 'Campo preferencias_turismo deve ser um array' }, 400)
    }
    const { data: validas, error: erroValidas } = await getAnonClient(c)
      .from('catalogo_itens')
      .select('codigo')
      .eq('tipo', 'preferencia_turismo')
      .eq('ativo', true)
    if (erroValidas) return c.json({ error: erroValidas.message }, 500)
    const codigos = new Set((validas ?? []).map((i) => i.codigo))
    if (!body.preferencias_turismo.every((p) => codigos.has(p))) {
      return c.json({ error: 'Campo preferencias_turismo contém valores inválidos' }, 400)
    }
  }

  const atualizacao: Record<string, unknown> = { nome: body.nome }
  if (body.nome_social !== undefined) atualizacao.nome_social = body.nome_social
  if (body.cep !== undefined) atualizacao.cep = body.cep
  if (body.endereco !== undefined) atualizacao.endereco = body.endereco
  if (body.cidade !== undefined) atualizacao.cidade = body.cidade
  if (body.uf !== undefined) atualizacao.uf = body.uf
  if (body.complemento !== undefined) atualizacao.complemento = body.complemento
  if (body.necessidades_acessibilidade !== undefined)
    atualizacao.necessidades_acessibilidade = body.necessidades_acessibilidade
  if (body.preferencias_turismo !== undefined) atualizacao.preferencias_turismo = [...new Set(body.preferencias_turismo)]

  const { data, error } = await supabase
    .from('usuarios')
    .update(atualizacao)
    .eq('id', userId)
    .select(
      'id, cpf, nome, nome_social, avatar_url, cep, endereco, cidade, uf, complemento, necessidades_acessibilidade, preferencias_turismo, created_at'
    )
    .single()

  if (error) return c.json({ error: error.message }, 400)
  return c.json(data)
}

interface AtualizarAvatarBody {
  imagem_base64?: string
  extensao?: string
}

export async function atualizarAvatar(c: Context<AppEnv>) {
  const supabase = c.get('supabase')
  const userId = c.get('userId')
  const body = await c.req.json<AtualizarAvatarBody>().catch(() => null)

  if (!body?.imagem_base64 || !body?.extensao) {
    return c.json({ error: 'Campos obrigatórios: imagem_base64, extensao' }, 400)
  }

  const extensao = body.extensao.toLowerCase()
  if (!(EXTENSOES_VALIDAS as readonly string[]).includes(extensao)) {
    return c.json(
      { error: `Campo extensao deve ser um dentre: ${EXTENSOES_VALIDAS.join(', ')}` },
      400
    )
  }

  let bytes: Uint8Array
  try {
    bytes = Uint8Array.from(atob(body.imagem_base64), (ch) => ch.charCodeAt(0))
  } catch {
    return c.json({ error: 'Campo imagem_base64 inválido' }, 400)
  }

  if (bytes.byteLength > TAMANHO_MAXIMO_AVATAR) {
    return c.json({ error: 'Imagem excede o tamanho máximo de 5MB' }, 400)
  }

  // Nome com carimbo de tempo: a URL muda a cada envio e o navegador não
  // mostra a foto antiga do cache.
  const path = `${userId}/avatar-${Date.now()}.${extensao}`
  const contentType = `image/${extensao === 'jpg' ? 'jpeg' : extensao}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, bytes, { contentType, upsert: true })

  if (uploadError) return c.json({ error: uploadError.message }, 500)

  const {
    data: { publicUrl },
  } = supabase.storage.from('avatars').getPublicUrl(path)

  const { error: updateError } = await supabase
    .from('usuarios')
    .update({ avatar_url: publicUrl })
    .eq('id', userId)

  if (updateError) return c.json({ error: updateError.message }, 500)

  return c.json({ avatar_url: publicUrl })
}

export async function minhasColaboracoes(c: Context<AppEnv>) {
  const supabase = c.get('supabase')
  const userId = c.get('userId')

  const { data, error } = await supabase
    .from('vinculos')
    .select('id, papel, paginas(id, nome, tipo, descricao)')
    .eq('usuario_id', userId)
    .eq('papel', 'colaborador')

  if (error) return c.json({ error: error.message }, 500)

  const colaboracoes = (data ?? []).map((item: Record<string, unknown>) => ({
    ...item,
    paginas: Array.isArray(item.paginas) ? (item.paginas[0] ?? null) : item.paginas,
  }))

  return c.json({ colaboracoes })
}
