import { describe, expect, it } from 'vitest'
import { montarLista } from './lista'

const dia = { data: '2026-11-07', vagas: 4, confirmados: ['Ricardo', 'Estevão'], espera: [], valorAvulsoCentavos: 1614 }
const norm = (s: string) => s.replace(/\s/g, ' ')

describe('montarLista', () => {
  it('troca as variáveis do cabeçalho', () => {
    expect(norm(montarLista('{DIA_SEMANA} {dia_semana} {data} {mes} {valor_avulso} {vagas}', dia)))
      .toBe('SÁBADO sábado 07/11 novembro R$ 16,14 4')
  })
  it('numera a lista e deixa as vagas abertas em branco', () => {
    expect(montarLista('{lista}', dia)).toBe('1 - Ricardo\n2 - Estevão\n3\n4')
  })
  it('lista cheia além das vagas continua numerando', () => {
    expect(montarLista('{lista}', { ...dia, vagas: 1 })).toBe('1 - Ricardo\n2 - Estevão')
  })
  it('espera vazia sai com 2 linhas em branco; com gente, sobra uma', () => {
    expect(montarLista('{espera}', dia)).toBe('1\n2')
    expect(montarLista('{espera}', { ...dia, espera: ['A', 'B'] })).toBe('1 - A\n2 - B\n3')
  })
  it('sem valor do avulso mostra traço e ignora chaves desconhecidas', () => {
    expect(montarLista('{valor_avulso} {outra}', { ...dia, valorAvulsoCentavos: null })).toBe('— {outra}')
  })
})
