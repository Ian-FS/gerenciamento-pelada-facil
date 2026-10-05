import type { AjustePrioridade, Mes, Participacao, Pesos, Sabado } from './types'

/** Peso da cota conforme o número de dias reservados no mês. Acima da maior faixa, usa a maior faixa. */
export function pesoPara(dias: number, pesos: Pesos): number {
  if (dias <= 0) return 0
  const faixas = Object.keys(pesos).map(Number).sort((a, b) => a - b)
  const faixa = faixas.filter((f) => f <= dias).pop() ?? faixas[0]
  return pesos[String(faixa)]
}

export interface LinhaRateio {
  jogador_id: string
  dias: number
  peso: number
  pontos: number
  /** valor de cada pelada para esse jogador, em centavos (arredondado, só informativo) */
  valor_pelada_centavos: number
  /** valor total da cota, em centavos (a soma de todos fecha exatamente o valor a ratear) */
  valor_centavos: number
}

export interface ResultadoRateio {
  linhas: LinhaRateio[]
  total_pontos: number
  valor_liquido_centavos: number
  /** valor de 1 ponto, em centavos (não arredondado) */
  valor_ponto: number | null
  /** valor que o avulso paga por pelada, em centavos */
  valor_avulso_centavos: number | null
}

/** Arredonda para 2 casas evitando lixo de ponto flutuante (ex.: 4 * 0.85). */
const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * Rateio do campo entre quem reservou antecipadamente.
 * Reserva com desistência continua contando: o jogador já pagou e não tem devolução.
 */
export function calcularRateio(
  mes: Pick<Mes, 'custo_campo_centavos' | 'abatimento_caixa_centavos' | 'pesos' | 'avulso_multiplicador'>,
  participacoes: Pick<Participacao, 'jogador_id' | 'tipo'>[],
): ResultadoRateio {
  const dias = new Map<string, number>()
  for (const p of participacoes) {
    if (p.tipo !== 'reserva') continue
    dias.set(p.jogador_id, (dias.get(p.jogador_id) ?? 0) + 1)
  }

  const base = [...dias.entries()].map(([jogador_id, d]) => {
    const peso = pesoPara(d, mes.pesos)
    return { jogador_id, dias: d, peso, pontos: r2(d * peso) }
  })
  const total_pontos = r2(base.reduce((s, l) => s + l.pontos, 0))
  const valor_liquido_centavos = mes.custo_campo_centavos - mes.abatimento_caixa_centavos

  if (total_pontos === 0) {
    return { linhas: [], total_pontos: 0, valor_liquido_centavos, valor_ponto: null, valor_avulso_centavos: null }
  }

  const valor_ponto = valor_liquido_centavos / total_pontos

  // Método do maior resto: arredonda para baixo e distribui os centavos que sobram.
  const exatos = base.map((l) => l.pontos * valor_ponto)
  const centavos = exatos.map(Math.floor)
  let sobra = valor_liquido_centavos - centavos.reduce((s, c) => s + c, 0)
  const ordemResto = exatos
    .map((e, i) => ({ i, resto: e - Math.floor(e) }))
    .sort((a, b) => b.resto - a.resto)
  for (const { i } of ordemResto) {
    if (sobra <= 0) break
    centavos[i]++
    sobra--
  }

  const linhas = base.map((l, i) => ({
    ...l,
    valor_pelada_centavos: Math.round(valor_ponto * l.peso),
    valor_centavos: centavos[i],
  }))

  return {
    linhas,
    total_pontos,
    valor_liquido_centavos,
    valor_ponto,
    valor_avulso_centavos: Math.round(valor_ponto * mes.avulso_multiplicador),
  }
}

export interface LinhaPrioridade {
  jogador_id: string
  pontos: number
  reservas: number
  ajustes: number
  zerado_em: string | null
  /** Reservas em que o jogador desistiu (critério de desempate: menos é melhor). */
  desistencias: number
  /** Peladas jogadas como avulso (critério de desempate: mais é melhor). */
  avulsos: number
  /** Data da reserva mais antiga que conta (critério de desempate: mais antiga é melhor). */
  primeira_reserva: string | null
}

/**
 * Prioridade = reservas antecipadas acumuladas (avulso e espera não contam) + ajustes manuais.
 * Um ajuste do tipo "zerar" descarta tudo o que veio antes da data dele.
 * Só conta o que é anterior a `antesDe` (yyyy-mm-dd), para refletir "até o fim do mês anterior".
 * Também conta desistências, avulsos e a primeira reserva, usados no desempate (ver compararPrioridade).
 * Avulsos sem sábado registrado usam o 1º dia do mês como data, se `meses` for informado.
 */
export function calcularPrioridade(
  participacoes: (Pick<Participacao, 'jogador_id' | 'tipo' | 'sabado_id'> & Partial<Pick<Participacao, 'desistiu' | 'mes_id'>>)[],
  sabados: Pick<Sabado, 'id' | 'data'>[],
  ajustes: Pick<AjustePrioridade, 'jogador_id' | 'tipo' | 'valor' | 'data'>[],
  antesDe?: string,
  meses: Pick<Mes, 'id' | 'ano' | 'mes'>[] = [],
): Map<string, LinhaPrioridade> {
  const dataSabado = new Map(sabados.map((s) => [s.id, s.data]))
  const dataMes = new Map(meses.map((m) => [m.id, inicioDoMes(m.ano, m.mes)]))
  const dentro = (data: string) => !antesDe || data < antesDe

  const zerado = new Map<string, string>()
  for (const a of ajustes) {
    if (a.tipo !== 'zerar' || !dentro(a.data)) continue
    const atual = zerado.get(a.jogador_id)
    if (!atual || a.data > atual) zerado.set(a.jogador_id, a.data)
  }

  const res = new Map<string, LinhaPrioridade>()
  const linha = (id: string) => {
    let l = res.get(id)
    if (!l) {
      l = {
        jogador_id: id, pontos: 0, reservas: 0, ajustes: 0, zerado_em: zerado.get(id) ?? null,
        desistencias: 0, avulsos: 0, primeira_reserva: null,
      }
      res.set(id, l)
    }
    return l
  }

  for (const p of participacoes) {
    if (p.tipo === 'espera') continue
    const data = p.sabado_id ? dataSabado.get(p.sabado_id) : p.tipo === 'avulso' && p.mes_id ? dataMes.get(p.mes_id) : undefined
    if (!data || !dentro(data)) continue
    const z = zerado.get(p.jogador_id)
    if (z && data < z) continue
    const l = linha(p.jogador_id)
    if (p.tipo === 'avulso') {
      l.avulsos++
      continue
    }
    l.reservas++
    if (p.desistiu) l.desistencias++
    if (!l.primeira_reserva || data < l.primeira_reserva) l.primeira_reserva = data
  }
  for (const a of ajustes) {
    if (a.tipo !== 'ajuste' || !dentro(a.data)) continue
    const z = zerado.get(a.jogador_id)
    if (z && a.data < z) continue
    linha(a.jogador_id).ajustes += a.valor
  }
  for (const id of zerado.keys()) linha(id)
  for (const l of res.values()) l.pontos = l.reservas + l.ajustes
  return res
}

/**
 * Ordem da prioridade: mais pontos; no empate, menos desistências, depois mais avulsos,
 * depois quem tem a reserva mais antiga. Retorna 0 se continuarem empatados.
 */
export function compararPrioridade(
  a: Pick<LinhaPrioridade, 'pontos' | 'desistencias' | 'avulsos' | 'primeira_reserva'> | undefined,
  b: Pick<LinhaPrioridade, 'pontos' | 'desistencias' | 'avulsos' | 'primeira_reserva'> | undefined,
): number {
  const [x, y] = [a ?? vazio, b ?? vazio]
  return (
    y.pontos - x.pontos ||
    x.desistencias - y.desistencias ||
    y.avulsos - x.avulsos ||
    (x.primeira_reserva ?? '9999').localeCompare(y.primeira_reserva ?? '9999')
  )
}
const vazio = { pontos: 0, desistencias: 0, avulsos: 0, primeira_reserva: null }

/** Primeiro dia do mês, no formato yyyy-mm-dd. */
export function inicioDoMes(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}-01`
}

/**
 * Distribui os pedidos de reserva de cada sábado pela ordem de prioridade.
 * `ordem` é a lista de jogadores do mais prioritário para o menos (empates já decididos pelo admin).
 * Os primeiros `vagas` de cada sábado viram reserva; o resto vai para a lista de espera daquele sábado.
 */
export function distribuirReservas(
  sabados: Pick<Sabado, 'id' | 'vagas'>[],
  pedidos: Map<string, Set<string>>,
  ordem: string[],
): { sabado_id: string; jogador_id: string; tipo: 'reserva' | 'espera'; ordem: number }[] {
  const posicao = new Map(ordem.map((id, i) => [id, i]))
  const out: { sabado_id: string; jogador_id: string; tipo: 'reserva' | 'espera'; ordem: number }[] = []
  for (const s of sabados) {
    const quem = [...(pedidos.get(s.id) ?? [])].sort(
      (a, b) => (posicao.get(a) ?? Infinity) - (posicao.get(b) ?? Infinity),
    )
    quem.forEach((jogador_id, i) =>
      out.push({ sabado_id: s.id, jogador_id, tipo: i < s.vagas ? 'reserva' : 'espera', ordem: i + 1 }),
    )
  }
  return out
}

/** Grupos de jogadores empatados (mesma pontuação), na ordem em que aparecem em `ordem`. */
export function gruposEmpate(ordem: string[], pontos: (id: string) => number): string[][] {
  const grupos: string[][] = []
  for (const id of ordem) {
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && pontos(ultimo[0]) === pontos(id)) ultimo.push(id)
    else grupos.push([id])
  }
  return grupos.filter((g) => g.length > 1)
}

export const formatarReais = (centavos: number) =>
  (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export const formatarData = (iso: string) => {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}
