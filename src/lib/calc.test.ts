import { describe, expect, it } from 'vitest'
import { calcularPrioridade, calcularRateio, compararPrioridade, distribuirReservas, gruposEmpate, pesoPara } from './calc'

const PESOS = { '1': 1, '2': 0.95, '3': 0.9, '4': 0.85, '5': 0.8 }
const mes = (custo: number, abatimento = 0) => ({ custo_campo_centavos: custo, abatimento_caixa_centavos: abatimento, pesos: PESOS, avulso_multiplicador: 1.1 })
const reservas = (lista: [string, number][]) =>
  lista.flatMap(([id, n]) => Array.from({ length: n }, () => ({ jogador_id: id, tipo: 'reserva' as const })))

describe('pesoPara', () => {
  it('usa a tabela e a maior faixa acima dela', () => {
    expect(pesoPara(1, PESOS)).toBe(1)
    expect(pesoPara(4, PESOS)).toBe(0.85)
    expect(pesoPara(6, PESOS)).toBe(0.8)
    expect(pesoPara(0, PESOS)).toBe(0)
  })
})

describe('calcularRateio', () => {
  it('reproduz março da planilha (R$ 700, 13×4 dias + 3×2 dias)', () => {
    const r = calcularRateio(mes(70000), reservas([
      ...Array.from({ length: 13 }, (_, i) => [`a${i}`, 4] as [string, number]),
      ['b1', 2], ['b2', 2], ['b3', 2],
    ]))
    expect(r.total_pontos).toBe(49.9)
    expect(r.valor_ponto! / 100).toBeCloseTo(14.028056, 5)
    expect(r.valor_avulso_centavos).toBe(1543)
    expect(r.linhas.find((l) => l.jogador_id === 'a0')!.valor_centavos).toBeGreaterThanOrEqual(4769)
    expect(r.linhas.find((l) => l.jogador_id === 'b1')!.valor_centavos).toBeGreaterThanOrEqual(2665)
    expect(r.linhas.reduce((s, l) => s + l.valor_centavos, 0)).toBe(70000)
  })

  it('a soma sempre fecha o valor líquido e o abatimento do caixa reduz o rateio', () => {
    const r = calcularRateio(mes(80000, 5000), reservas([['a', 5], ['b', 3], ['c', 1], ['d', 2]]))
    expect(r.valor_liquido_centavos).toBe(75000)
    expect(r.linhas.reduce((s, l) => s + l.valor_centavos, 0)).toBe(75000)
  })

  it('reserva com desistência continua no rateio; avulso e espera não entram', () => {
    const r = calcularRateio(mes(10000), [
      { jogador_id: 'a', tipo: 'reserva' },
      { jogador_id: 'b', tipo: 'avulso' },
      { jogador_id: 'c', tipo: 'espera' },
    ])
    expect(r.linhas.map((l) => l.jogador_id)).toEqual(['a'])
    expect(r.valor_avulso_centavos).toBe(11000)
  })
})

describe('calcularPrioridade', () => {
  const sabados = [{ id: 's1', data: '2026-09-05' }, { id: 's2', data: '2026-10-03' }]
  const parts = [
    { jogador_id: 'a', tipo: 'reserva' as const, sabado_id: 's1' },
    { jogador_id: 'a', tipo: 'reserva' as const, sabado_id: 's2' },
    { jogador_id: 'a', tipo: 'avulso' as const, sabado_id: 's2' },
    { jogador_id: 'b', tipo: 'espera' as const, sabado_id: 's1' },
  ]
  it('conta só reservas e respeita a data limite', () => {
    expect(calcularPrioridade(parts, sabados, []).get('a')!.pontos).toBe(2)
    expect(calcularPrioridade(parts, sabados, [], '2026-10-01').get('a')!.pontos).toBe(1)
    expect(calcularPrioridade(parts, sabados, []).get('b')).toBeUndefined()
  })
  it('zerar descarta o que veio antes e ajuste soma', () => {
    const r = calcularPrioridade(parts, sabados, [
      { jogador_id: 'a', tipo: 'zerar', valor: 0, data: '2026-09-20' },
      { jogador_id: 'a', tipo: 'ajuste', valor: 3, data: '2026-09-21' },
    ])
    expect(r.get('a')!.pontos).toBe(4)
  })
  it('conta desistências, avulsos (inclusive sem sábado) e a primeira reserva', () => {
    const r = calcularPrioridade(
      [
        ...parts,
        { jogador_id: 'a', tipo: 'reserva', sabado_id: 's1', desistiu: true },
        { jogador_id: 'a', tipo: 'avulso', sabado_id: null, mes_id: 'm9' },
        { jogador_id: 'a', tipo: 'avulso', sabado_id: null, mes_id: 'm10' },
      ],
      sabados, [], '2026-10-01', [{ id: 'm9', ano: 2026, mes: 9 }, { id: 'm10', ano: 2026, mes: 10 }],
    ).get('a')!
    expect(r).toMatchObject({ pontos: 2, desistencias: 1, avulsos: 1, primeira_reserva: '2026-09-05' })
  })
})

describe('compararPrioridade', () => {
  const l = (pontos: number, desistencias: number, avulsos: number, primeira_reserva: string | null) =>
    ({ pontos, desistencias, avulsos, primeira_reserva })
  it('desempata por menos desistências, mais avulsos e reserva mais antiga', () => {
    const ordem = [
      ['e', l(10, 0, 0, '2026-03-07')],
      ['d', l(10, 0, 2, '2026-05-02')],
      ['c', l(10, 0, 2, '2026-04-04')],
      ['b', l(10, 1, 9, '2026-01-03')],
      ['a', l(12, 3, 0, null)],
    ] as const
    const ids = [...ordem].sort((x, y) => compararPrioridade(x[1], y[1])).map((x) => x[0])
    expect(ids).toEqual(['a', 'c', 'd', 'e', 'b'])
  })
  it('trata jogador sem linha como zero', () => {
    expect(compararPrioridade(undefined, l(1, 0, 0, null))).toBeGreaterThan(0)
  })
})

describe('distribuirReservas', () => {
  it('preenche as vagas por prioridade e manda o resto para a espera', () => {
    const r = distribuirReservas([{ id: 's', vagas: 2 }], new Map([['s', new Set(['c', 'a', 'b'])]]), ['a', 'b', 'c'])
    expect(r.map((x) => [x.jogador_id, x.tipo])).toEqual([['a', 'reserva'], ['b', 'reserva'], ['c', 'espera']])
  })
  it('identifica empates', () => {
    const pts: Record<string, number> = { a: 5, b: 3, c: 3, d: 1 }
    expect(gruposEmpate(['a', 'b', 'c', 'd'], (id) => pts[id])).toEqual([['b', 'c']])
  })
})
