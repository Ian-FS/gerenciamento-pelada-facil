import { useState } from 'react'
import { Plus } from 'lucide-react'
import { diasDoMes, rotuloDia } from '../lib/calc'
import { cn } from '../lib/cn'

/**
 * Escolha dos dias de jogo de um mês. Mostra como sugestão os dias da semana padrão da pelada
 * (Configurações), e qualquer outra data do mês pode ser adicionada. Clicar num dia liga/desliga.
 */
export function SeletorDias({ ano, mes, diasSemana, valor, onChange }: {
  ano: number
  mes: number
  /** dias da semana sugeridos (0 = domingo … 6 = sábado) */
  diasSemana: number[]
  valor: string[]
  onChange: (datas: string[]) => void
}) {
  const [adicionando, setAdicionando] = useState(false)
  const opcoes = [...new Set([...diasDoMes(ano, mes, diasSemana), ...valor])].sort()
  const p = (n: number) => String(n).padStart(2, '0')
  const primeiro = `${ano}-${p(mes)}-01`
  const ultimo = `${ano}-${p(mes)}-${p(new Date(ano, mes, 0).getDate())}`

  const alternar = (d: string) => onChange(valor.includes(d) ? valor.filter((x) => x !== d) : [...valor, d].sort())
  const adicionar = (d: string) => {
    if (d >= primeiro && d <= ultimo && !valor.includes(d)) onChange([...valor, d].sort())
    setAdicionando(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {opcoes.map((d) => {
        const on = valor.includes(d)
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            onClick={() => alternar(d)}
            className={cn('h-8 rounded-lg border px-2.5 text-xs font-semibold transition-colors', on ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-foreground')}
          >
            {rotuloDia(d)}
          </button>
        )
      })}
      {adicionando ? (
        <input
          type="date"
          autoFocus
          min={primeiro}
          max={ultimo}
          className="h-8 text-xs"
          onChange={(e) => e.target.value && adicionar(e.target.value)}
          onBlur={() => setAdicionando(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdicionando(true)}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-dashed border-border px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <Plus size={13} /> Adicionar dia
        </button>
      )}
    </div>
  )
}
