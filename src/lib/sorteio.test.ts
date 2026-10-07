import { describe, expect, it } from 'vitest'
import { aplicarVotos, normalizarNome, parearPorNome } from './sorteio'
import type { Jogador } from './types'

const j = (id: string, nome: string, extra: Partial<Jogador> = {}): Jogador => ({ id, nome, ativo: true, sorteio_id: null, ...extra })

describe('normalizarNome', () => {
  it('ignora acento, maiúscula e espaços', () => {
    expect(normalizarNome('  João  Vitor ')).toBe('joao vitor')
    expect(normalizarNome('JOÃO VÍTOR')).toBe('joao vitor')
  })
})

describe('parearPorNome', () => {
  it('vincula nomes iguais, ignorando acento', () => {
    expect(parearPorNome([j('g1', 'João'), j('g2', 'Pedro')], [{ id: 's1', nome: 'joao' }, { id: 's2', nome: 'Pedro' }]))
      .toEqual([{ jogadorId: 'g1', sorteioId: 's1' }, { jogadorId: 'g2', sorteioId: 's2' }])
  })
  it('não mexe em quem já está vinculado, dos dois lados', () => {
    const r = parearPorNome([j('g1', 'João', { sorteio_id: 's9' }), j('g2', 'Pedro')], [{ id: 's9', nome: 'Pedro' }, { id: 's1', nome: 'João' }])
    expect(r).toEqual([])
  })
  it('homônimo fica para o admin', () => {
    expect(parearPorNome([j('g1', 'Lucas')], [{ id: 's1', nome: 'Lucas' }, { id: 's2', nome: 'lucas' }])).toEqual([])
    expect(parearPorNome([j('g1', 'Lucas'), j('g2', 'Lúcas')], [{ id: 's1', nome: 'Lucas' }])).toEqual([])
  })
  it('nome parecido não vincula sozinho', () => {
    expect(parearPorNome([j('g1', 'Lucas M.')], [{ id: 's1', nome: 'Lucas' }])).toEqual([])
  })
})

describe('aplicarVotos', () => {
  const jogadores = [j('g1', 'Ana', { sorteio_id: 's1' }), j('g2', 'Beto', { sorteio_id: 's2', ativo: false })]

  it('monta os pedidos por data com o id da Gestão', () => {
    const r = aplicarVotos([{ playerId: 's1', nome: 'Ana', datas: ['2026-11-07', '2026-11-14'] }], jogadores)
    expect(r.pedidos).toEqual({ '2026-11-07': ['g1'], '2026-11-14': ['g1'] })
  })
  it('sem vínculo e inativo viram pendência, não pedido', () => {
    const r = aplicarVotos([
      { playerId: 's2', nome: 'Beto', datas: ['2026-11-07'] },
      { playerId: 's3', nome: 'Caio', datas: ['2026-11-07'] },
    ], jogadores)
    expect(r.pedidos).toEqual({})
    expect(r.inativos.map((x) => x.jogador.id)).toEqual(['g2'])
    expect(r.semVinculo.map((x) => x.playerId)).toEqual(['s3'])
  })
  it('"não vou em nenhum" não gera pendência', () => {
    const r = aplicarVotos([{ playerId: 's3', nome: 'Caio', datas: [] }], jogadores)
    expect(r).toEqual({ pedidos: {}, semVinculo: [], inativos: [] })
  })
})
