import type { ReactNode } from 'react'
import { RefreshCw, TriangleAlert, type LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Botao } from './botao'

export function CabecalhoPagina({
  titulo, descricao, acoes, className,
}: { titulo: ReactNode; descricao?: ReactNode; acoes?: ReactNode; className?: string }) {
  return (
    <header className={cn('mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0">
        <h1 className="font-display flex flex-wrap items-center gap-2 text-2xl font-bold sm:text-3xl">{titulo}</h1>
        {descricao && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{descricao}</p>}
      </div>
      {acoes && <div className="flex shrink-0 flex-wrap items-center gap-2">{acoes}</div>}
    </header>
  )
}

/** Compatibilidade com o componente antigo. */
export function Titulo({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  return <CabecalhoPagina titulo={children} acoes={extra} />
}

export function Esqueleto({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-secondary/70', className)} />
}

export function Vazio({
  icone: Icone, titulo, descricao, acao, className,
}: { icone: LucideIcon; titulo: string; descricao?: ReactNode; acao?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-10 text-center', className)}>
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
        <Icone size={22} />
      </span>
      <p className="font-display font-semibold">{titulo}</p>
      {descricao && <p className="mt-1 max-w-xs text-sm text-muted-foreground">{descricao}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  )
}

export function ErroCarregar({ erro }: { erro: unknown }) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-card">
      <Vazio
        icone={TriangleAlert}
        titulo="Não foi possível carregar"
        descricao={(erro as Error)?.message ?? String(erro)}
        acao={<Botao icone={RefreshCw} onClick={() => window.location.reload()}>Tentar de novo</Botao>}
      />
    </div>
  )
}

/** Estado de carregamento da página (esqueleto) ou erro. */
export function Carregando({ erro }: { erro?: unknown }) {
  if (erro) return <ErroCarregar erro={erro} />
  return (
    <div aria-busy="true" aria-label="Carregando">
      <Esqueleto className="mb-2 h-8 w-56" />
      <Esqueleto className="mb-6 h-4 w-80 max-w-full" />
      <div className="grid gap-3 md:grid-cols-2">
        <Esqueleto className="h-40 rounded-2xl" />
        <Esqueleto className="h-40 rounded-2xl" />
        <Esqueleto className="hidden h-40 rounded-2xl md:block" />
        <Esqueleto className="hidden h-40 rounded-2xl md:block" />
      </div>
    </div>
  )
}
