import { useEffect, useRef, useState } from 'react'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { NOMES_MESES } from '../../lib/calc'
import { cn } from '../../lib/cn'
import { IconeBotao } from './botao'
import { useTelaGrande } from './menu'
import { Modal } from './modal'

export interface Periodo {
  id: string
  ano: number
  mes: number
}

export const nomePeriodo = (p: Pick<Periodo, 'ano' | 'mes'>) => `${NOMES_MESES[p.mes - 1]} de ${p.ano}`

/**
 * Escolha de mês: setas para o anterior/próximo e, no meio, um botão que abre
 * o calendário de meses (ano no topo, grade com os 12 meses). Meses sem dados ficam desabilitados.
 */
export function SeletorPeriodo({
  periodos, valor, onChange, className,
}: { periodos: Periodo[]; valor: string; onChange: (id: string) => void; className?: string }) {
  const ordenados = [...periodos].sort((a, b) => a.ano - b.ano || a.mes - b.mes)
  const i = ordenados.findIndex((p) => p.id === valor)
  const atual = ordenados[i]
  const anterior = ordenados[i - 1]
  const proximo = ordenados[i + 1]

  const [aberto, setAberto] = useState(false)
  const grande = useTelaGrande()
  const caixa = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto || !grande) return
    const fora = (e: MouseEvent) => !caixa.current?.contains(e.target as Node) && setAberto(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false)
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [aberto, grande])

  const escolher = (id: string) => {
    setAberto(false)
    onChange(id)
  }
  if (!atual) return null

  return (
    <div ref={caixa} className={cn('relative flex items-center gap-1 rounded-xl border border-border bg-card p-1', className)}>
      <IconeBotao icone={ChevronLeft} rotulo="Mês anterior" tamanho="sm" disabled={!anterior} onClick={() => anterior && onChange(anterior.id)} />
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={aberto}
        onClick={() => setAberto((a) => !a)}
        className="flex h-8 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring sm:min-w-48"
      >
        <CalendarDays size={15} className="text-primary" />
        <span className="num">{nomePeriodo(atual)}</span>
        <ChevronDown size={14} className={cn('text-muted-foreground transition-transform', aberto && 'rotate-180')} />
      </button>
      <IconeBotao icone={ChevronRight} rotulo="Próximo mês" tamanho="sm" disabled={!proximo} onClick={() => proximo && onChange(proximo.id)} />

      {aberto && grande && (
        <div
          role="dialog"
          aria-label="Escolher mês"
          className="animate-zoom-in absolute top-full right-0 z-40 mt-2 w-72 origin-top-right rounded-2xl border border-border bg-card/95 p-3 shadow-xl shadow-black/30 backdrop-blur-xl"
        >
          <GradeMeses periodos={ordenados} atual={atual} onEscolher={escolher} />
        </div>
      )}
      {!grande && (
        <Modal aberto={aberto} onFechar={() => setAberto(false)} titulo="Escolher mês" focoInicial={false}>
          <div className="pb-[env(safe-area-inset-bottom)]">
            <GradeMeses periodos={ordenados} atual={atual} onEscolher={escolher} grande />
          </div>
        </Modal>
      )}
    </div>
  )
}

function GradeMeses({
  periodos, atual, onEscolher, grande,
}: { periodos: Periodo[]; atual: Periodo; onEscolher: (id: string) => void; grande?: boolean }) {
  const anos = [...new Set(periodos.map((p) => p.ano))]
  const [ano, setAno] = useState(atual.ano)
  const iAno = anos.indexOf(ano)
  const porMes = new Map(periodos.filter((p) => p.ano === ano).map((p) => [p.mes, p]))
  const hoje = new Date()

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <IconeBotao icone={ChevronLeft} rotulo="Ano anterior" tamanho="sm" disabled={iAno <= 0} onClick={() => setAno(anos[iAno - 1])} />
        <span className="font-display num text-base font-semibold">{ano}</span>
        <IconeBotao icone={ChevronRight} rotulo="Próximo ano" tamanho="sm" disabled={iAno >= anos.length - 1} onClick={() => setAno(anos[iAno + 1])} />
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {NOMES_MESES.map((nome, i) => {
          const p = porMes.get(i + 1)
          const selecionado = p?.id === atual.id
          const mesAtual = ano === hoje.getFullYear() && i === hoje.getMonth()
          return (
            <button
              key={nome}
              type="button"
              disabled={!p}
              aria-current={selecionado ? 'date' : undefined}
              aria-label={`${nome} de ${ano}${p ? '' : ' (sem peladas)'}`}
              onClick={() => p && onEscolher(p.id)}
              className={cn(
                'relative rounded-lg border text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                grande ? 'h-12' : 'h-9',
                selecionado
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : p
                    ? 'border-transparent text-foreground hover:bg-secondary'
                    : 'cursor-not-allowed border-transparent text-muted-foreground/35',
              )}
            >
              {nome.slice(0, 3)}
              {mesAtual && <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary" aria-hidden />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
