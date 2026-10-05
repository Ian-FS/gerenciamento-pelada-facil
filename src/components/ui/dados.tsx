import { useEffect, useRef, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'

/* Cores de status e categorias. Fundo com ~15% de opacidade e texto na cor cheia. */
export const cores = {
  verde: { chip: 'bg-primary/15 text-primary', barra: 'bg-primary', texto: 'text-primary', ponto: 'bg-primary' },
  azul: { chip: 'bg-c-azul/15 text-c-azul', barra: 'bg-c-azul', texto: 'text-c-azul', ponto: 'bg-c-azul' },
  amarelo: { chip: 'bg-c-amarelo/15 text-c-amarelo', barra: 'bg-c-amarelo', texto: 'text-c-amarelo', ponto: 'bg-c-amarelo' },
  ambar: { chip: 'bg-c-ambar/15 text-c-ambar', barra: 'bg-c-ambar', texto: 'text-c-ambar', ponto: 'bg-c-ambar' },
  vermelho: { chip: 'bg-c-vermelho/15 text-c-vermelho', barra: 'bg-c-vermelho', texto: 'text-c-vermelho', ponto: 'bg-c-vermelho' },
  laranja: { chip: 'bg-c-laranja/15 text-c-laranja', barra: 'bg-c-laranja', texto: 'text-c-laranja', ponto: 'bg-c-laranja' },
  ciano: { chip: 'bg-c-ciano/15 text-c-ciano', barra: 'bg-c-ciano', texto: 'text-c-ciano', ponto: 'bg-c-ciano' },
  roxo: { chip: 'bg-c-roxo/15 text-c-roxo', barra: 'bg-c-roxo', texto: 'text-c-roxo', ponto: 'bg-c-roxo' },
  esmeralda: { chip: 'bg-c-esmeralda/15 text-c-esmeralda', barra: 'bg-c-esmeralda', texto: 'text-c-esmeralda', ponto: 'bg-c-esmeralda' },
  cinza: { chip: 'bg-secondary text-muted-foreground', barra: 'bg-c-cinza', texto: 'text-muted-foreground', ponto: 'bg-c-cinza' },
}
export type Cor = keyof typeof cores

export function Etiqueta({
  cor = 'cinza', icone: Icone, className, children,
}: { cor?: Cor; icone?: LucideIcon; className?: string; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap', cores[cor].chip, className)}>
      {Icone && <Icone size={12} strokeWidth={2.5} />}
      {children}
    </span>
  )
}

export function BarraProgresso({
  valor, max, cor = 'verde', className, rotulo,
}: { valor: number; max: number; cor?: Cor; className?: string; rotulo?: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (valor / max) * 100)) : 0
  return (
    <div
      role="progressbar"
      aria-valuenow={valor}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={rotulo}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-secondary', className)}
    >
      <div className={cn('h-full rounded-full transition-all duration-500', cores[cor].barra)} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function CartaoMetrica({
  icone: Icone, rotulo, valor, detalhe, cor = 'verde', className,
}: { icone: LucideIcon; rotulo: string; valor: ReactNode; detalhe?: ReactNode; cor?: Cor; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3 rounded-2xl border border-border bg-card p-4', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{rotulo}</span>
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', cores[cor].chip)}>
          <Icone size={16} />
        </span>
      </div>
      <div>
        <div className="num font-display text-xl font-bold sm:text-2xl">{valor}</div>
        {detalhe && <div className="mt-0.5 text-[11px] text-muted-foreground">{detalhe}</div>}
      </div>
    </div>
  )
}

const coresAvatar: Cor[] = ['azul', 'ciano', 'roxo', 'laranja', 'esmeralda', 'amarelo', 'vermelho', 'ambar']

export function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter((p) => p.length > 2 || /^[A-ZÀ-Ú]/.test(p))
  const [a, b] = partes.length ? partes : [nome]
  return ((a?.[0] ?? '') + (b?.[0] ?? '')).toUpperCase() || '?'
}

/** Círculo com as iniciais; a cor é fixa por nome. */
export function Avatar({ nome, tamanho = 'md', className }: { nome: string; tamanho?: 'sm' | 'md' | 'lg'; className?: string }) {
  let h = 0
  for (const c of nome) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const cor = coresAvatar[h % coresAvatar.length]
  const t = { sm: 'h-7 w-7 text-[10px]', md: 'h-9 w-9 text-xs', lg: 'h-11 w-11 text-sm' }[tamanho]
  return (
    <span aria-hidden className={cn('flex shrink-0 items-center justify-center rounded-full font-semibold', t, cores[cor].chip, className)}>
      {iniciais(nome)}
    </span>
  )
}

export interface Opcao<T extends string> {
  valor: T
  rotulo: ReactNode
  icone?: LucideIcon
}

/** Controle segmentado (uma opção entre poucas). */
export function Segmentado<T extends string>({
  opcoes, valor, onChange, className, rotulo,
}: { opcoes: Opcao<T>[]; valor: T; onChange: (v: T) => void; className?: string; rotulo?: string }) {
  return (
    <div role="radiogroup" aria-label={rotulo} className={cn('inline-flex rounded-xl border border-border bg-background p-1', className)}>
      {opcoes.map(({ valor: v, rotulo: r, icone: Icone }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={v === valor}
          onClick={() => onChange(v)}
          className={cn(
            'inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
            v === valor ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {Icone && <Icone size={14} />}
          {r}
        </button>
      ))}
    </div>
  )
}

/** Chips horizontais roláveis (ex.: escolher o mês). O ativo fica visível ao abrir. */
export function SeletorChips<T extends string>({
  opcoes, valor, onChange, className, rotulo,
}: { opcoes: Opcao<T>[]; valor: T; onChange: (v: T) => void; className?: string; rotulo?: string }) {
  const ativo = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const el = ativo.current
    const pai = el?.parentElement
    if (el && pai) pai.scrollLeft = el.offsetLeft - pai.clientWidth / 2 + el.clientWidth / 2
  }, [valor])
  return (
    <div role="radiogroup" aria-label={rotulo} className={cn('no-scrollbar relative -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0', className)}>
      {opcoes.map(({ valor: v, rotulo: r, icone: Icone }) => (
        <button
          key={v}
          ref={v === valor ? ativo : undefined}
          type="button"
          role="radio"
          aria-checked={v === valor}
          onClick={() => onChange(v)}
          className={cn(
            'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
            v === valor
              ? 'border-primary/50 bg-primary/10 text-primary'
              : 'border-border bg-card text-muted-foreground hover:text-foreground',
          )}
        >
          {Icone && <Icone size={14} />}
          {r}
        </button>
      ))}
    </div>
  )
}
