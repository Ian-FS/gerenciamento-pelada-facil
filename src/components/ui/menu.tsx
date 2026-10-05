import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { EllipsisVertical, type LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'
import { IconeBotao } from './botao'
import { Modal } from './modal'

export interface ItemMenu {
  rotulo: string
  icone?: LucideIcon
  onClick: () => void
  perigo?: boolean
  oculto?: boolean
  desabilitado?: boolean
}

function useTelaGrande() {
  const consulta = '(min-width: 640px)'
  const [grande, setGrande] = useState(() => window.matchMedia(consulta).matches)
  useEffect(() => {
    const mq = window.matchMedia(consulta)
    const f = () => setGrande(mq.matches)
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [])
  return grande
}

/**
 * Menu de ações. No desktop abre um dropdown junto do botão;
 * no celular abre um sheet com itens grandes, mais fáceis de tocar.
 */
export function Menu({
  itens, rotulo = 'Mais ações', titulo, gatilho, tamanho = 'md', className,
}: {
  itens: ItemMenu[]
  rotulo?: string
  /** Título do sheet no celular (ex.: o nome do jogador). */
  titulo?: ReactNode
  /** Gatilho personalizado; por padrão, um botão com ⋮. */
  gatilho?: (abrir: () => void, aberto: boolean) => ReactNode
  tamanho?: 'sm' | 'md'
  className?: string
}) {
  const [aberto, setAberto] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; acima: boolean } | null>(null)
  const ancora = useRef<HTMLSpanElement>(null)
  const lista = useRef<HTMLDivElement>(null)
  const grande = useTelaGrande()
  const visiveis = itens.filter((i) => !i.oculto)

  const fechar = () => setAberto(false)
  const escolher = (i: ItemMenu) => {
    fechar()
    i.onClick()
  }

  useLayoutEffect(() => {
    if (!aberto || !grande || !ancora.current) return
    const r = ancora.current.getBoundingClientRect()
    const largura = 224
    const altura = visiveis.length * 40 + 8
    const acima = r.bottom + altura + 8 > window.innerHeight && r.top > altura
    setPos({
      top: acima ? r.top - altura - 4 : r.bottom + 4,
      left: Math.max(8, Math.min(r.right - largura, window.innerWidth - largura - 8)),
      acima,
    })
  }, [aberto, grande, visiveis.length])

  useEffect(() => {
    if (!aberto || !grande) return
    lista.current?.querySelector<HTMLElement>('[role=menuitem]:not([disabled])')?.focus()
    const fora = (e: MouseEvent) => {
      if (!lista.current?.contains(e.target as Node) && !ancora.current?.contains(e.target as Node)) fechar()
    }
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        fechar()
        ancora.current?.querySelector('button')?.focus()
      }
    }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    window.addEventListener('resize', fechar)
    window.addEventListener('scroll', fechar, true)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', esc)
      window.removeEventListener('resize', fechar)
      window.removeEventListener('scroll', fechar, true)
    }
  }, [aberto, grande])

  const navegar = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const els = [...(lista.current?.querySelectorAll<HTMLElement>('[role=menuitem]:not([disabled])') ?? [])]
    const i = els.indexOf(document.activeElement as HTMLElement)
    els[(i + (e.key === 'ArrowDown' ? 1 : -1) + els.length) % els.length]?.focus()
  }

  if (!visiveis.length) return null
  const abrir = () => setAberto((a) => !a)

  return (
    <span ref={ancora} className={cn('inline-flex', className)}>
      {gatilho ? gatilho(abrir, aberto) : (
        <IconeBotao icone={EllipsisVertical} rotulo={rotulo} tamanho={tamanho} aria-haspopup="menu" aria-expanded={aberto} onClick={abrir} />
      )}

      {aberto && grande && pos && createPortal(
        <div
          ref={lista}
          role="menu"
          onKeyDown={navegar}
          style={{ top: pos.top, left: pos.left }}
          className="animate-zoom-in fixed z-50 w-56 rounded-xl border border-border bg-card/95 p-1 shadow-xl shadow-black/30 backdrop-blur-xl"
        >
          {visiveis.map((i) => <ItemBotao key={i.rotulo} item={i} onEscolher={escolher} />)}
        </div>,
        document.body,
      )}

      {!grande && (
        <Modal aberto={aberto} onFechar={fechar} titulo={titulo ?? rotulo} focoInicial={false}>
          <div role="menu" className="-mx-2 -mt-1 flex flex-col pb-[env(safe-area-inset-bottom)]">
            {visiveis.map((i) => <ItemBotao key={i.rotulo} item={i} onEscolher={escolher} grande />)}
          </div>
        </Modal>
      )}
    </span>
  )
}

function ItemBotao({ item, onEscolher, grande }: { item: ItemMenu; onEscolher: (i: ItemMenu) => void; grande?: boolean }) {
  const Icone = item.icone
  return (
    <button
      type="button"
      role="menuitem"
      disabled={item.desabilitado}
      onClick={() => onEscolher(item)}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 text-left text-sm outline-none transition-colors disabled:opacity-40',
        grande ? 'h-12 text-base' : 'h-9',
        item.perigo
          ? 'text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10'
          : 'hover:bg-secondary focus-visible:bg-secondary',
      )}
    >
      {Icone && <Icone size={grande ? 18 : 16} className={item.perigo ? '' : 'text-muted-foreground'} />}
      {item.rotulo}
    </button>
  )
}
