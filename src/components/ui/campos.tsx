import type { ComponentProps, ReactNode } from 'react'
import { Check, ChevronDown, type LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'

const baseCampo =
  'w-full rounded-xl border border-input bg-background text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50'

export function Input({
  icone: Icone, prefixo, sufixo, className, ...props
}: ComponentProps<'input'> & { icone?: LucideIcon; prefixo?: string; sufixo?: ReactNode }) {
  const campo = cn(baseCampo, 'h-10 px-3', (Icone || prefixo) && 'pl-9', sufixo != null && 'pr-9')
  if (!Icone && !prefixo && sufixo == null) return <input {...props} className={cn(campo, className)} />
  return (
    <div className={cn('relative flex items-center', className)}>
      {Icone && <Icone size={16} className="pointer-events-none absolute left-3 text-muted-foreground" />}
      {prefixo && <span className="pointer-events-none absolute left-3 text-sm text-muted-foreground">{prefixo}</span>}
      <input {...props} className={campo} />
      {sufixo && <span className="absolute right-3 flex items-center text-sm text-muted-foreground">{sufixo}</span>}
    </div>
  )
}

export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <div className={cn('relative', className)}>
      <select {...props} className={cn(baseCampo, 'h-10 cursor-pointer appearance-none pr-9 pl-3')}>
        {children}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea {...props} className={cn(baseCampo, 'min-h-20 px-3 py-2', className)} />
}

/** Rótulo + campo + dica/erro. */
export function Campo({
  rotulo, dica, erro, className, children,
}: { rotulo: ReactNode; dica?: ReactNode; erro?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-xs font-medium text-muted-foreground">{rotulo}</span>
      {children}
      {erro ? <span className="text-[11px] text-destructive">{erro}</span> : dica && <span className="text-[11px] text-muted-foreground">{dica}</span>}
    </label>
  )
}

/** Compatibilidade com o componente antigo. */
export function Rotulo({ texto, children }: { texto: string; children: ReactNode }) {
  return <Campo rotulo={texto}>{children}</Campo>
}

/** Checkbox com área de toque de 40px. */
export function Checkbox({
  className, children, ...props
}: Omit<ComponentProps<'input'>, 'type'> & { children?: ReactNode }) {
  return (
    <label className={cn('inline-flex min-h-10 min-w-10 cursor-pointer items-center justify-center gap-2 text-sm', className)}>
      <input type="checkbox" {...props} className="peer sr-only" />
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-muted-foreground/40 bg-background text-primary-foreground transition-colors peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-disabled:opacity-50 [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100">
        <Check size={14} strokeWidth={3} />
      </span>
      {children}
    </label>
  )
}
