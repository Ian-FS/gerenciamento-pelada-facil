import { useMemo, useState } from 'react'
import { useBase } from '../lib/api'
import { calcularPrioridade, compararPrioridade, inicioDoMes, NOMES_MESES } from '../lib/calc'
import { CabecalhoPagina, Card, Carregando, Etiqueta, nomePeriodo, SeletorPeriodo } from '../components/ui'

export default function PrioridadePage() {
  const { data, error } = useBase()
  const [ref, setRef] = useState('') // '' = todas as reservas já feitas

  const linhas = useMemo(() => {
    if (!data) return []
    const prio = calcularPrioridade(data.participacoes, data.sabados, data.ajustes, ref || undefined, data.meses)
    const nomes = new Map(data.jogadores.map((j) => [j.id, j]))
    return [...prio.values()]
      .filter((l) => nomes.get(l.jogador_id)?.ativo && l.pontos > 0)
      .sort((a, b) => compararPrioridade(a, b) || nomes.get(a.jogador_id)!.nome.localeCompare(nomes.get(b.jogador_id)!.nome))
      .map((l, i) => ({ ...l, nome: nomes.get(l.jogador_id)!.nome, posicao: i + 1 }))
  }, [data, ref])

  if (!data) return <Carregando erro={error} />

  // Cada período é "prioridade válida para o mês X" (conta as reservas até o mês anterior).
  // O último é o próximo mês, ainda não criado, que conta todas as reservas feitas.
  const ultimo = data.meses[data.meses.length - 1]
  const seguinte = (ano: number, mes: number) => (mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 })
  const periodos = [
    ...data.meses.map((m) => ({ id: inicioDoMes(m.ano, m.mes), ano: m.ano, mes: m.mes })),
    ...(ultimo ? [{ id: '', ...seguinte(ultimo.ano, ultimo.mes) }] : []),
  ]
  const escolhido = periodos.find((p) => p.id === ref)
  const anterior = escolhido && (escolhido.mes === 1 ? { ano: escolhido.ano - 1, mes: 12 } : { ano: escolhido.ano, mes: escolhido.mes - 1 })
  const temAnterior = anterior && data.meses.some((m) => m.ano === anterior.ano && m.mes === anterior.mes)

  return (
    <div>
      <CabecalhoPagina
        titulo="Prioridade de reserva"
        descricao={
          escolhido && (
            <>
              Ordem para <span className="font-medium text-foreground">{nomePeriodo(escolhido).toLowerCase()}</span>,{' '}
              {temAnterior ? `com as reservas feitas até ${NOMES_MESES[anterior.mes - 1].toLowerCase()}` : 'com as reservas anteriores'}.
            </>
          )
        }
        acoes={periodos.length > 0 && <SeletorPeriodo className="w-full sm:w-auto" periodos={periodos} valor={ref} onChange={setRef} />}
      />
      <p className="mb-4 text-sm text-neutral-400">
        Cada reserva antecipada vale 1 ponto. Pelada avulsa e lista de espera não contam. Quem tem mais pontos tem
        prioridade na hora de distribuir as vagas de cada sábado. Em caso de empate, fica na frente quem desistiu menos,
        depois quem jogou mais como avulso e, por fim, quem reservou primeiro.
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
