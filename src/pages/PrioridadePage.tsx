import { useMemo, useState } from 'react'
import { useBase } from '../lib/api'
import { calcularPrioridade, inicioDoMes, NOMES_MESES } from '../lib/calc'
import { Card, Carregando, Etiqueta, Titulo } from '../components/ui'

export default function PrioridadePage() {
  const { data, error } = useBase()
  const [ref, setRef] = useState('') // '' = todas as reservas já feitas

  const linhas = useMemo(() => {
    if (!data) return []
    const prio = calcularPrioridade(data.participacoes, data.sabados, data.ajustes, ref || undefined)
    const nomes = new Map(data.jogadores.map((j) => [j.id, j]))
    const ordenadas = [...prio.values()]
      .filter((l) => nomes.get(l.jogador_id)?.ativo && l.pontos > 0)
      .sort((a, b) => b.pontos - a.pontos || nomes.get(a.jogador_id)!.nome.localeCompare(nomes.get(b.jogador_id)!.nome))
    // posição com empate (1, 2, 2, 4…)
    return ordenadas.map((l, i) => ({
      ...l,
      nome: nomes.get(l.jogador_id)!.nome,
      posicao: ordenadas.findIndex((o) => o.pontos === l.pontos) + 1,
      empatado: ordenadas.filter((o) => o.pontos === l.pontos).length > 1,
      i,
    }))
  }, [data, ref])

  if (!data) return <Carregando erro={error} />

  const proximo = (() => {
    const ultimo = data.meses[data.meses.length - 1]
    if (!ultimo) return 'o próximo mês'
    const m = ultimo.mes === 12 ? 1 : ultimo.mes + 1
    return `${NOMES_MESES[m - 1]}/${ultimo.mes === 12 ? ultimo.ano + 1 : ultimo.ano}`
  })()

  return (
    <div>
      <Titulo
        extra={
          <select value={ref} onChange={(e) => setRef(e.target.value)}>
            <option value="">Para {proximo} (todas as reservas)</option>
            {[...data.meses].reverse().map((m) => (
              <option key={m.id} value={inicioDoMes(m.ano, m.mes)}>
                Para {NOMES_MESES[m.mes - 1]}/{m.ano} (até o mês anterior)
              </option>
            ))}
          </select>
        }
      >
        Prioridade de reserva
      </Titulo>
      <p className="mb-4 text-sm text-neutral-400">
        Cada reserva antecipada vale 1 ponto. Pelada avulsa e lista de espera não contam. Quem tem mais pontos tem
        prioridade na hora de distribuir as vagas de cada sábado.
      </p>
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-400">
            <tr className="border-b border-neutral-800">
              <th className="w-12 px-4 py-2">#</th>
              <th className="px-2 py-2">Jogador</th>
              <th className="px-4 py-2 text-right">Pontos</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.jogador_id} className="border-b border-neutral-800/60 last:border-0">
                <td className="px-4 py-2 font-semibold text-neutral-400">{l.posicao}º</td>
                <td className="px-2 py-2">
                  <span className="font-medium">{l.nome}</span>{' '}
                  {l.empatado && <Etiqueta cor="amarelo">empate</Etiqueta>}{' '}
                  {l.zerado_em && <Etiqueta cor="azul">zerado em {l.zerado_em.split('-').reverse().join('/')}</Etiqueta>}
                </td>
                <td className="px-4 py-2 text-right">
                  <span className="text-base font-bold">{l.pontos}</span>
                  {l.ajustes !== 0 && (
                    <span className="ml-1 text-xs text-neutral-500">
                      ({l.reservas} {l.ajustes > 0 ? '+' : '−'} {Math.abs(l.ajustes)} ajuste)
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {linhas.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-neutral-500">Nenhuma reserva ainda.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
