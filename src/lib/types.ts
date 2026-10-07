export type Pesos = Record<string, number>

export interface Configuracoes {
  id: number
  vagas_padrao: number
  custo_campo_padrao_centavos: number
  avulso_multiplicador: number
  pesos: Pesos
  /** dias da semana sugeridos para os jogos (0 = domingo … 6 = sábado) */
  dias_semana_padrao: number[]
}

export interface Jogador {
  id: string
  nome: string
  ativo: boolean
  /** id do jogador no app Sorteio; null = ainda não vinculado */
  sorteio_id: string | null
}

export interface Mes {
  id: string
  ano: number
  mes: number
  custo_campo_centavos: number
  abatimento_caixa_centavos: number
  pesos: Pesos
  avulso_multiplicador: number
  encerrado: boolean
  observacao: string | null
}

export interface Sabado {
  id: string
  mes_id: string
  data: string // yyyy-mm-dd
  vagas: number
  observacao: string | null
}

export type TipoParticipacao = 'reserva' | 'avulso' | 'espera'

export interface Participacao {
  id: string
  mes_id: string
  sabado_id: string | null
  jogador_id: string
  tipo: TipoParticipacao
  desistiu: boolean
  ordem: number
  observacao: string | null
}

export interface PagamentoRateio {
  mes_id: string
  jogador_id: string
  pago: boolean
  pago_em: string | null
  ajuste_centavos: number
  observacao: string | null
}

export interface PagamentoAvulso {
  participacao_id: string
  pago: boolean
  pago_em: string | null
}

export interface AjustePrioridade {
  id: string
  jogador_id: string
  tipo: 'zerar' | 'ajuste'
  valor: number
  data: string // yyyy-mm-dd
  motivo: string | null
}
