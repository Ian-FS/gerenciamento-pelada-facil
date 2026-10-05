import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CircleCheck, CircleX, Info, X } from 'lucide-react'
import { cn } from '../../lib/cn'

type Tipo = 'sucesso' | 'erro' | 'info'
interface Item { id: number; tipo: Tipo; texto: string }

interface Toast {
  sucesso: (texto: string) => void
  erro: (texto: string) => void
  info: (texto: string) => void
  fechar: (id: number) => void
}

const Ctx = createContext<Toast | null>(null)

const visual = {
  sucesso: { icone: CircleCheck, cor: 'text-primary', borda: 'border-primary/30' },
  erro: { icone: CircleX, cor: 'text-destructive', borda: 'border-destructive/40' },
  info: { icone: Info, cor: 'text-c-azul', borda: 'border-border' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [itens, setItens] = useState<Item[]>([])
  const timers = useRef(new Map<number, number>())
  const seq = useRef(0)

  const lista = useRef<Item[]>([])

  const api = useMemo<Toast>(() => {
    const atualizar = (l: Item[]) => {
      lista.current = l
      setItens(l)
    }
    const fechar = (id: number) => {
      window.clearTimeout(timers.current.get(id))
      timers.current.delete(id)
      atualizar(lista.current.filter((i) => i.id !== id))
    }
    const mostrar = (tipo: Tipo) => (texto: string) => {
      // Mesma mensagem repetida: só reinicia o tempo em vez de empilhar.
      const igual = lista.current.find((i) => i.tipo === tipo && i.texto === texto)
      const id = igual?.id ?? ++seq.current
      window.clearTimeout(timers.current.get(id))
      timers.current.set(id, window.setTimeout(() => fechar(id), tipo === 'erro' ? 6000 : 2500))
      if (!igual) atualizar([...lista.current, { id, tipo, texto }].slice(-3))
    }
    return { sucesso: mostrar('sucesso'), erro: mostrar('erro'), info: mostrar('info'), fechar }
  }, [])

  return (
    <Ctx.Provider value={api}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6"
        >
          {itens.map((t) => {
            const { icone: Icone, cor, borda } = visual[t.tipo]
            return (
              <div
                key={t.id}
                role={t.tipo === 'erro' ? 'alert' : 'status'}
                className={cn('animate-fab-item pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border bg-card p-3.5 shadow-xl shadow-black/30', borda)}
              >
                <Icone size={18} className={cn('mt-px shrink-0', cor)} />
                <p className="flex-1 text-sm">{t.texto}</p>
                <button
                  aria-label="Fechar aviso"
                  className="-m-1 rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  onClick={() => api.fechar(t.id)}
                >
                  <X size={14} />
                </button>
              </div>
            )
          })}
        </div>,
        document.body,
      )}
    </Ctx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast precisa do ToastProvider')
  return ctx
}
