import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { requireAuth } from './middleware/auth'
import { signup, login, refresh } from './routes/auth'
import {
  obterPerfil,
  atualizarPerfil,
  atualizarAvatar,
  minhasColaboracoes,
} from './routes/perfil'
import { buscarPaginas, obterPagina, denunciarInformacao } from './routes/paginas'
import { listarCatalogo } from './routes/catalogo'
import { compartilharPagina } from './routes/compartilhar'
import { criarAvaliacao, minhasAvaliacoes } from './routes/avaliacoes'
import { listarFavoritos, adicionarFavorito, removerFavorito } from './routes/favoritos'
import { listarFiltrosAcessibilidade } from './routes/filtros'
import {
  listarNotificacoes,
  contarNaoLidas,
  marcarComoLida,
  marcarTodasComoLidas,
} from './routes/notificacoes'
import type { AppEnv } from './types'

const app = new Hono<AppEnv>()

app.use('*', cors())

app.get('/health', (c) => c.json({ status: 'ok', area: c.env.AREA, service: 'backend' }))

// Autenticação (1 conta por CPF)
app.post('/auth/signup', signup)
app.post('/auth/login', login)
app.post('/auth/refresh', refresh)

// Busca e página do empreendimento (exigem login)
app.get('/paginas', requireAuth, buscarPaginas)
app.get('/paginas/:id', requireAuth, obterPagina)
app.post('/paginas/:id/denuncias', requireAuth, denunciarInformacao)

// Link de compartilhamento com prévia (público; redireciona para o site)
app.get('/s/:id', compartilharPagina)

// Catálogo de rótulos/ícones mantido pela Área 04 (público)
app.get('/catalogo', listarCatalogo)

// Filtros de acessibilidade (público, gerenciado pela Área04)
app.get('/filtros-acessibilidade', listarFiltrosAcessibilidade)

// Perfil pessoal (autenticado)
app.get('/perfil', requireAuth, obterPerfil)
app.put('/perfil', requireAuth, atualizarPerfil)
app.post('/perfil/avatar', requireAuth, atualizarAvatar)
app.get('/minhas-colaboracoes', requireAuth, minhasColaboracoes)

// Favoritos (autenticado)
app.get('/favoritos', requireAuth, listarFavoritos)
app.post('/favoritos/:id', requireAuth, adicionarFavorito)
app.delete('/favoritos/:id', requireAuth, removerFavorito)

// Avaliações (autenticado)
app.post('/paginas/:id/avaliacoes', requireAuth, criarAvaliacao)
app.get('/me/avaliacoes', requireAuth, minhasAvaliacoes)

// Notificações (autenticado)
app.get('/notificacoes', requireAuth, listarNotificacoes)
app.get('/notificacoes/contagem-nao-lidas', requireAuth, contarNaoLidas)
app.patch('/notificacoes/:id/ler', requireAuth, marcarComoLida)
app.patch('/notificacoes/marcar-todas-lidas', requireAuth, marcarTodasComoLidas)

export default app
