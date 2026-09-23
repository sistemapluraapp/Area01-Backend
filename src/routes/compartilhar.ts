import type { Context } from 'hono'
import { getAnonClient } from '../lib/supabase'
import type { AppEnv } from '../types'

function escapar(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// Link de compartilhamento: WhatsApp, Facebook etc. não executam JavaScript,
// então este endpoint devolve um HTML com as tags de prévia (capa, título e
// descrição curta) e redireciona a pessoa para a página no site da Plura —
// que exige login para ver o conteúdo completo.
export async function compartilharPagina(c: Context<AppEnv>) {
  const id = c.req.param('id') as string
  const destino = `${c.env.FRONTEND_URL}/pagina?id=${encodeURIComponent(id)}`

  const { data: p } = await getAnonClient(c)
    .from('paginas')
    .select('nome, subtitulo, descricao_curta, capa_url, logo_url, cidade, uf, suspensa')
    .eq('id', id)
    .single()

  if (!p || p.suspensa) return c.redirect(c.env.FRONTEND_URL, 302)

  const local = [p.cidade, p.uf].filter(Boolean).join('/')
  const titulo = escapar(`${p.nome}${p.subtitulo ? ` · ${p.subtitulo}` : ''} | Plura`)
  const descricao = escapar(p.descricao_curta || [p.subtitulo, local].filter(Boolean).join(' · ') || 'Turismo acessível na Plura')
  const imagem = p.capa_url || p.logo_url
  const url = escapar(destino)

  c.header('Cache-Control', 'public, max-age=600')
  return c.html(`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${titulo}</title>
<meta name="description" content="${descricao}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Plura">
<meta property="og:title" content="${titulo}">
<meta property="og:description" content="${descricao}">
<meta property="og:url" content="${url}">
${imagem ? `<meta property="og:image" content="${escapar(imagem)}">\n<meta name="twitter:image" content="${escapar(imagem)}">` : ''}
<meta name="twitter:card" content="${imagem ? 'summary_large_image' : 'summary'}">
<meta http-equiv="refresh" content="0; url=${url}">
</head>
<body>
<p><a href="${url}">Abrir ${escapar(p.nome)} na Plura</a></p>
<script>location.replace(${JSON.stringify(destino)})</script>
</body>
</html>`)
}
