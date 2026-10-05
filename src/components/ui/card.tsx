import type { ComponentProps, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} className={cn('rounded-2xl border border-border bg-card p-4', className)} />
}

export function CardCabecalho({
  icone: Icone, titulo, subtitulo, acoes, className,
}: { icone?: LucideIcon; titulo: ReactNode; subtitulo?: ReactNode; acoes?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3 border-b border-border px-4 py-3', className)}>
      {Icone && (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icone size={18} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-base font-semibold">{titulo}</h2>
        {subtitulo && <p className="text-xs text-muted-foreground">{subtitulo}</p>}
      </div>
      {acoes && <div className="flex items-center gap-2">{acoes}</div>}
    </div>
  )
}
