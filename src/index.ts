import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { optionalAuth, requireAuth } from './middleware/auth'
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
import { agendaEventos, eventosDaPagina, marcarInteresseEvento, meusEventos, removerInteresseEvento } from './routes/eventos'
import { listarFavoritos, adicionarFavorito, removerFavorito } from './routes/favoritos'
import { adicionarLocalFavorito, definirAvisosEmail, listarLocaisFavoritos, removerLocalFavorito } from './routes/locaisFavoritos'
import { listarFiltrosAcessibilidade } from './routes/filtros'
import {
  listarNotificacoes,
  contarNaoLidas,
  marcarComoLida,
  marcarTodasComoLidas,
} from './routes/notificacoes'
import { obterConteudoPagina, obterTermo, reenviarConfirmacao } from './routes/conteudo'
import { listarCidades, listarEstados } from './routes/localidades'
import { recuperarSenha, redefinirSenha } from './routes/senha'
import type { AppEnv } from './types'

const app = new Hono<AppEnv>()

app.use('*', cors())

app.get('/health', (c) => c.json({ status: 'ok', area: c.env.AREA, service: 'backend' }))

// Autenticação (1 conta por CPF)
app.post('/auth/signup', signup)
app.post('/auth/login', login)
app.post('/auth/recuperar-senha', recuperarSenha)
app.post('/auth/redefinir-senha', redefinirSenha)
app.post('/auth/refresh', refresh)
app.post('/auth/reenviar-confirmacao', reenviarConfirmacao)
app.get('/conteudo/:chave', obterConteudoPagina)
app.get('/termos/:chave', obterTermo)
app.get('/localidades/:pais/estados', listarEstados)
app.get('/localidades/:pais/estados/:estado/cidades', listarCidades)

// Busca e página do empreendimento (exigem login)
// Busca e página completa são abertas a visitantes; salvar, avaliar e denunciar pedem login.
app.get('/paginas', optionalAuth, buscarPaginas)
app.get('/paginas/:id', optionalAuth, obterPagina)
app.get('/paginas/:id/eventos', optionalAuth, eventosDaPagina)
app.get('/eventos', optionalAuth, agendaEventos)
app.post('/eventos/:id/interesse', requireAuth, marcarInteresseEvento)
app.delete('/eventos/:id/interesse', requireAuth, removerInteresseEvento)
app.get('/meus-eventos', requireAuth, meusEventos)
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
app.get('/locais-favoritos', requireAuth, listarLocaisFavoritos)
app.post('/locais-favoritos', requireAuth, adicionarLocalFavorito)
app.delete('/locais-favoritos/:id', requireAuth, removerLocalFavorito)
app.put('/locais-favoritos/avisos-email', requireAuth, definirAvisosEmail)

// Avaliações (autenticado)
app.post('/paginas/:id/avaliacoes', requireAuth, criarAvaliacao)
app.get('/me/avaliacoes', requireAuth, minhasAvaliacoes)

// Notificações (autenticado)
app.get('/notificacoes', requireAuth, listarNotificacoes)
app.get('/notificacoes/contagem-nao-lidas', requireAuth, contarNaoLidas)
app.patch('/notificacoes/:id/ler', requireAuth, marcarComoLida)
app.patch('/notificacoes/marcar-todas-lidas', requireAuth, marcarTodasComoLidas)

export default app
