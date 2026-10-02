import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type {
  AjustePrioridade, Configuracoes, Jogador, Mes, PagamentoAvulso, PagamentoRateio, Participacao, Sabado,
} from './types'

/** Lê a tabela inteira, paginando (o Supabase devolve no máximo 1000 linhas por vez). */
async function todos<T>(tabela: string, ordem?: string): Promise<T[]> {
  const out: T[] = []
  for (let de = 0; ; de += 1000) {
    let q = supabase.from(tabela).select('*').range(de, de + 999)
    if (ordem) q = q.order(ordem)
    const { data, error } = await q
    if (error) throw error
    out.push(...(data as T[]))
    if (data.length < 1000) return out
  }
}

export interface Base {
  config: Configuracoes
  jogadores: Jogador[]
  meses: Mes[]
  sabados: Sabado[]
  participacoes: Participacao[]
  ajustes: AjustePrioridade[]
}

const numerico = <T extends { avulso_multiplicador: number }>(x: T): T => ({
  ...x,
  avulso_multiplicador: Number(x.avulso_multiplicador),
})

/** Todos os dados públicos. O volume é pequeno, então carregamos tudo de uma vez. */
export function useBase() {
  return useQuery({
    queryKey: ['base'],
    queryFn: async (): Promise<Base> => {
      const [config, jogadores, meses, sabados, participacoes, ajustes] = await Promise.all([
        todos<Configuracoes>('configuracoes'),
        todos<Jogador>('jogadores', 'nome'),
        todos<Mes>('meses'),
        todos<Sabado>('sabados', 'data'),
        todos<Participacao>('participacoes'),
        todos<AjustePrioridade>('ajustes_prioridade'),
      ])
      return {
        config: numerico(config[0]),
        jogadores,
        meses: meses.map(numerico).sort((a, b) => a.ano - b.ano || a.mes - b.mes),
        sabados,
        participacoes: participacoes.sort((a, b) => a.ordem - b.ordem),
        ajustes,
      }
    },
  })
}

/** Pagamentos (só o admin consegue ler). */
export function usePagamentos(habilitado: boolean) {
  return useQuery({
    queryKey: ['pagamentos'],
    enabled: habilitado,
    queryFn: async () => {
      const [rateio, avulso] = await Promise.all([
        todos<PagamentoRateio>('pagamentos_rateio'),
        todos<PagamentoAvulso>('pagamentos_avulso'),
      ])
      return { rateio, avulso }
    },
  })
}

/** Executa uma ou mais operações no Supabase e recarrega os dados. */
export function useSalvar() {
  const qc = useQueryClient()
  return async (...ops: PromiseLike<{ error: unknown }>[]) => {
    for (const op of ops) {
      const { error } = await op
      if (error) {
        alert('Erro ao salvar: ' + ((error as { message?: string }).message ?? String(error)))
        throw error
      }
    }
    await qc.invalidateQueries()
  }
}
