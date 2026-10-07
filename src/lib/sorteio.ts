// Ponte com o app Pelada Fácil Sorteio (Firebase), onde os jogadores votam nos dias de jogo do mês.
// Sem o SDK do Firebase: leitura pela API REST do Firestore (as coleções são de leitura
// pública) e ações de admin pelas Cloud Functions, provando quem somos com o token do Supabase.
// Ver docs/plano-votacao-datas.md no repositório do Sorteio.
import { supabase } from './supabase'
import type { Jogador } from './types'

const projeto = import.meta.env.VITE_SORTEIO_PROJECT_ID as string | undefined
const apiKey = import.meta.env.VITE_SORTEIO_API_KEY as string | undefined
const peladaId = import.meta.env.VITE_SORTEIO_PELADA_ID as string | undefined

export const sorteioConfigurado = Boolean(projeto && peladaId)

export interface JogadorSorteio {
  id: string
  nome: string
}

export interface VotacaoSorteio {
  ano: number
  mes: number
  datas: string[]
  status: 'aberta' | 'encerrada'
  prazo?: string
  importadaEm?: string
}

export interface VotoSorteio {
  playerId: string
  /** null quando o jogador foi removido do Sorteio depois de votar */
  nome: string | null
  datas: string[]
}

export const idMes = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, '0')}`

// ---------- Funções puras (testadas em sorteio.test.ts) ----------

/** Nome para comparação: sem acento, minúsculo, espaços simples. */
export function normalizarNome(nome: string): string {
  return nome.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ')
}

/**
 * Pares seguros para vincular sozinho: mesmo nome normalizado, os dois lados ainda sem vínculo
 * e o nome único em cada lado. Qualquer dúvida fica para o admin resolver.
 */
export function parearPorNome(jogadores: Jogador[], sorteio: JogadorSorteio[]): { jogadorId: string; sorteioId: string }[] {
  const usados = new Set(jogadores.map((j) => j.sorteio_id).filter(Boolean))
  const livresG = jogadores.filter((j) => !j.sorteio_id)
  const livresS = sorteio.filter((s) => !usados.has(s.id))
  const agrupar = <T>(lista: T[], nome: (x: T) => string) => {
    const m = new Map<string, T[]>()
    for (const x of lista) m.set(nome(x), [...(m.get(nome(x)) ?? []), x])
    return m
  }
  const porNomeS = agrupar(livresS, (s) => normalizarNome(s.nome))
  const out: { jogadorId: string; sorteioId: string }[] = []
  for (const [nome, gs] of agrupar(livresG, (j) => normalizarNome(j.nome))) {
    const ss = porNomeS.get(nome)
    if (gs.length === 1 && ss?.length === 1) out.push({ jogadorId: gs[0].id, sorteioId: ss[0].id })
  }
  return out
}

/**
 * Transforma os votos do Sorteio em pedidos do Novo mês (data → ids de jogadores).
 * Quem não tem vínculo, ou está inativo (a tabela de pedidos só mostra ativos), fica de fora
 * e volta como pendência para o admin resolver — nunca some em silêncio.
 */
export function aplicarVotos(votos: VotoSorteio[], jogadores: Jogador[]) {
  const porSorteioId = new Map(jogadores.filter((j) => j.sorteio_id).map((j) => [j.sorteio_id!, j]))
  const pedidos: Record<string, string[]> = {}
  const semVinculo: VotoSorteio[] = []
  const inativos: { jogador: Jogador; datas: string[] }[] = []
  for (const v of votos) {
    if (v.datas.length === 0) continue // "não vou em nenhum"
    const j = porSorteioId.get(v.playerId)
    if (!j) semVinculo.push(v)
    else if (!j.ativo) inativos.push({ jogador: j, datas: v.datas })
    else for (const d of v.datas) pedidos[d] = [...(pedidos[d] ?? []), j.id]
  }
  return { pedidos, semVinculo, inativos }
}

// ---------- Leitura (Firestore REST, pública) ----------

interface ValorFirestore {
  stringValue?: string
  integerValue?: string
  arrayValue?: { values?: ValorFirestore[] }
}
interface DocFirestore {
  name: string
  fields?: Record<string, ValorFirestore>
}

const base = () => `https://firestore.googleapis.com/v1/projects/${projeto}/databases/(default)/documents/peladas/${peladaId}`
const texto = (v?: ValorFirestore) => v?.stringValue
const lista = (v?: ValorFirestore) => (v?.arrayValue?.values ?? []).map((x) => x.stringValue ?? '')
const idDoc = (d: DocFirestore) => d.name.slice(d.name.lastIndexOf('/') + 1)

// 403 = as regras do Firestore do Sorteio ainda não liberam a coleção (deploy pendente).
const erroLeitura = (status: number) =>
  new Error(status === 403 ? 'o Sorteio recusou a leitura (403). As regras do Firestore com a votação já foram publicadas?' : `erro ${status} ao ler o Sorteio.`)

async function lerColecao(caminho: string, campos: string[]): Promise<DocFirestore[]> {
  const out: DocFirestore[] = []
  let pageToken = ''
  do {
    const q = new URLSearchParams({ pageSize: '300' })
    for (const c of campos) q.append('mask.fieldPaths', c)
    if (pageToken) q.set('pageToken', pageToken)
    if (apiKey) q.set('key', apiKey)
    const r = await fetch(`${base()}/${caminho}?${q}`)
    if (!r.ok) throw erroLeitura(r.status)
    const json = (await r.json()) as { documents?: DocFirestore[]; nextPageToken?: string }
    out.push(...(json.documents ?? []))
    pageToken = json.nextPageToken ?? ''
  } while (pageToken)
  return out
}

export async function listarJogadoresSorteio(): Promise<JogadorSorteio[]> {
  const docs = await lerColecao('players', ['name'])
  return docs.map((d) => ({ id: idDoc(d), nome: texto(d.fields?.name) ?? '' })).sort((a, b) => a.nome.localeCompare(b.nome))
}

/** A votação do mês e quantos já votaram; null se ainda não foi aberta. */
export async function lerVotacao(ano: number, mes: number): Promise<{ votacao: VotacaoSorteio; votaram: number } | null> {
  const q = apiKey ? `?key=${apiKey}` : ''
  const r = await fetch(`${base()}/votacoesDatas/${idMes(ano, mes)}${q}`)
  if (r.status === 404) return null
  if (!r.ok) throw erroLeitura(r.status)
  const f = ((await r.json()) as DocFirestore).fields ?? {}
  const votos = await lerColecao(`votacoesDatas/${idMes(ano, mes)}/votos`, ['atualizadoEm'])
  return {
    votacao: {
      ano: Number(f.ano?.integerValue ?? ano),
      mes: Number(f.mes?.integerValue ?? mes),
      datas: lista(f.datas),
      status: texto(f.status) === 'aberta' ? 'aberta' : 'encerrada',
      prazo: texto(f.prazo),
      importadaEm: texto(f.importadaEm),
    },
    votaram: votos.length,
  }
}

/** Mesma regra da função votarDatasFn: aberta e dentro do prazo. */
export const aceitaVotos = (v: VotacaoSorteio, agora = Date.now()) =>
  v.status === 'aberta' && (v.prazo === undefined || Date.parse(v.prazo) > agora)

// ---------- Ações de admin (Cloud Functions) ----------

async function chamar<T>(funcao: string, dados: Record<string, unknown>): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const gestaoToken = data.session?.access_token
  if (!gestaoToken) throw new Error('Sessão expirada. Entre de novo.')
  // O token vai no corpo: no cabeçalho Authorization o callable o leria como token do Firebase.
  const r = await fetch(`https://southamerica-east1-${projeto}.cloudfunctions.net/${funcao}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { peladaId, ...dados, gestaoToken } }),
  })
  const json = (await r.json().catch(() => ({}))) as { result?: T; error?: { message?: string } }
  if (!r.ok || json.error) throw new Error(json.error?.message ?? `Erro ao falar com o Sorteio (${r.status}).`)
  return json.result as T
}

export const abrirVotacao = (ano: number, mes: number, datas: string[], prazo?: string) =>
  chamar('abrirVotacaoDatasFn', { ano, mes, datas, ...(prazo ? { prazo } : {}) })

export const encerrarVotacao = (ano: number, mes: number) => chamar('encerrarVotacaoDatasFn', { ano, mes })

/** Encerra (se aberta) e devolve os votos, numa operação só lá no Sorteio. */
export const importarVotacao = (ano: number, mes: number) =>
  chamar<{ votacao: VotacaoSorteio; votos: VotoSorteio[] }>('importarVotacaoDatasFn', { ano, mes })
