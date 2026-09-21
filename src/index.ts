import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { requireAuth } from './middleware/auth'
import { signup, login } from './routes/auth'
import {
  obterPerfil,
  atualizarPerfil,
  atualizarAvatar,
  minhasColaboracoes,
} from './routes/perfil'
import { buscarPaginas, obterPagina } from './routes/paginas'
import { criarAvaliacao, minhasAvaliacoes } from './routes/avaliacoes'
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

// Busca pública de Páginas (sem login)
app.get('/paginas', buscarPaginas)
app.get('/paginas/:id', obterPagina)

// Perfil pessoal (autenticado)
app.get('/perfil', requireAuth, obterPerfil)
app.put('/perfil', requireAuth, atualizarPerfil)
app.post('/perfil/avatar', requireAuth, atualizarAvatar)
app.get('/minhas-colaboracoes', requireAuth, minhasColaboracoes)

// Avaliações (autenticado)
app.post('/paginas/:id/avaliacoes', requireAuth, criarAvaliacao)
app.get('/me/avaliacoes', requireAuth, minhasAvaliacoes)

// Notificações (autenticado)
app.get('/notificacoes', requireAuth, listarNotificacoes)
app.get('/notificacoes/contagem-nao-lidas', requireAuth, contarNaoLidas)
app.patch('/notificacoes/:id/ler', requireAuth, marcarComoLida)
app.patch('/notificacoes/marcar-todas-lidas', requireAuth, marcarTodasComoLidas)

export default app
