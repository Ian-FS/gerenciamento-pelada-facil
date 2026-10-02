import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 ${className}`}>{children}</div>
}

type Variante = 'primario' | 'secundario' | 'perigo' | 'fantasma'
const estilos: Record<Variante, string> = {
  primario: 'bg-emerald-600 text-white hover:bg-emerald-500',
  secundario: 'border border-neutral-700 bg-neutral-800 text-neutral-100 hover:bg-neutral-700',
  perigo: 'bg-red-600/90 text-white hover:bg-red-500',
  fantasma: 'text-neutral-300 hover:bg-neutral-800',
}

export function Botao({
  variante = 'secundario', pequeno, className = '', ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; pequeno?: boolean }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1 rounded-lg font-medium transition disabled:opacity-40 ${
        pequeno ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'
      } ${estilos[variante]} ${className}`}
    />
  )
}

const cores = {
  verde: 'bg-emerald-500/15 text-emerald-400',
  amarelo: 'bg-amber-500/15 text-amber-400',
  vermelho: 'bg-red-500/15 text-red-400',
  azul: 'bg-sky-500/15 text-sky-400',
  cinza: 'bg-neutral-700/50 text-neutral-300',
}
export function Etiqueta({ cor = 'cinza', children }: { cor?: keyof typeof cores; children: ReactNode }) {
  return <span className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${cores[cor]}`}>{children}</span>
}

export function Titulo({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-xl font-bold">{children}</h1>
      {extra}
    </div>
  )
}

export function Carregando({ erro }: { erro?: unknown }) {
  if (erro) return <p className="text-red-400">Erro ao carregar: {(erro as Error).message ?? String(erro)}</p>
  return <p className="text-neutral-400">Carregando…</p>
}

export function Rotulo({ texto, children }: { texto: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-neutral-300">
      {texto}
      {children}
    </label>
  )
}
