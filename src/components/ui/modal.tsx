import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { IconeBotao } from './botao'

let abertos = 0

/** Trava o scroll da página enquanto houver algum overlay aberto. */
export function useTravarScroll(ativo: boolean) {
  useEffect(() => {
    if (!ativo) return
    if (abertos++ === 0) document.body.style.overflow = 'hidden'
    return () => {
      if (--abertos === 0) document.body.style.overflow = ''
    }
  }, [ativo])
}

const focaveis = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Sheet colado embaixo no celular e modal centralizado a partir de `sm`.
 * Fecha com Esc e clicando fora; devolve o foco a quem abriu.
 */
export function Modal({
  aberto, onFechar, titulo, descricao, children, rodape, className, focoInicial = true,
}: {
  aberto: boolean
  onFechar: () => void
  titulo: ReactNode
  descricao?: ReactNode
  children?: ReactNode
  rodape?: ReactNode
  className?: string
  /** Foca o primeiro campo ao abrir. */
  focoInicial?: boolean
}) {
  const painel = useRef<HTMLDivElement>(null)
  const id = useId()
  const fechar = useRef(onFechar)
  fechar.current = onFechar
  useTravarScroll(aberto)

  useEffect(() => {
    if (!aberto) return
    const anterior = document.activeElement as HTMLElement | null
    const el = painel.current
    if (el && focoInicial) {
      const campo = el.querySelector<HTMLElement>('input, select, textarea') ?? el.querySelector<HTMLElement>('[data-rodape] button:last-child')
      campo?.focus()
    } else el?.focus()

    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        fechar.current()
      }
      if (e.key === 'Tab' && el) {
        const itens = [...el.querySelectorAll<HTMLElement>(focaveis)]
        if (!itens.length) return
        const [primeiro, ultimo] = [itens[0], itens[itens.length - 1]]
        if (e.shiftKey && document.activeElement === primeiro) {
          e.preventDefault()
          ultimo.focus()
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault()
          primeiro.focus()
        }
      }
    }
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('keydown', tecla)
      anterior?.focus?.()
    }
  }, [aberto, focoInicial])

  if (!aberto) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onFechar} aria-hidden />
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        tabIndex={-1}
        className={cn(
          'animate-slide-up sm:animate-zoom-in relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border-t border-border bg-card shadow-2xl outline-none sm:max-h-[88vh] sm:max-w-lg sm:rounded-2xl sm:border',
          className,
        )}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border sm:hidden" aria-hidden />
        <div className="sticky top-0 flex items-start gap-3 border-b border-border bg-card px-5 pt-3 pb-3 sm:pt-4">
          <div className="min-w-0 flex-1">
            <h2 id={`${id}-t`} className="font-display text-lg font-semibold">{titulo}</h2>
            {descricao && <p className="mt-0.5 text-sm text-muted-foreground">{descricao}</p>}
          </div>
          <IconeBotao icone={X} rotulo="Fechar" tamanho="sm" onClick={onFechar} className="-mr-2" />
        </div>
        {children && <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>}
        {rodape && (
          <div
            data-rodape
            className="flex flex-col-reverse gap-2 border-t [&>button]:w-full sm:[&>button]:w-auto border-border px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:flex-row sm:justify-end sm:pb-3"
          >
            {rodape}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
