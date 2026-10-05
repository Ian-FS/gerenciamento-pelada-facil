import type { ComponentProps } from 'react'
import { LoaderCircle, type LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'

const variantes = {
  primario: 'bg-primary text-primary-foreground hover:opacity-90',
  secundario: 'bg-secondary text-secondary-foreground hover:bg-border',
  fantasma: 'text-muted-foreground hover:bg-secondary hover:text-foreground',
  perigo: 'bg-destructive text-destructive-foreground hover:opacity-90',
  perigoSuave: 'text-destructive/80 hover:bg-destructive/10 hover:text-destructive',
  contorno: 'border border-border text-foreground hover:bg-secondary',
}
export type VarianteBotao = keyof typeof variantes

const tamanhos = {
  sm: 'h-8 gap-1 rounded-lg px-2.5 text-xs',
  md: 'h-10 gap-1.5 rounded-xl px-3.5 text-sm',
  lg: 'h-12 gap-2 rounded-xl px-5 text-base',
}
const tamanhoIcone = { sm: 14, md: 16, lg: 18 }

type PropsBotao = ComponentProps<'button'> & {
  variante?: VarianteBotao
  tamanho?: keyof typeof tamanhos
  /** Atalho antigo para tamanho="sm". */
  pequeno?: boolean
  icone?: LucideIcon
  carregando?: boolean
}

export function Botao({
  variante = 'secundario', tamanho, pequeno, icone: Icone, carregando, className, children, disabled, type = 'button', ...props
}: PropsBotao) {
  const t = tamanho ?? (pequeno ? 'sm' : 'md')
  return (
    <button
      type={type}
      {...props}
      disabled={disabled || carregando}
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-[opacity,background-color,color] outline-none select-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
        tamanhos[t],
        variantes[variante],
        className,
      )}
    >
      {carregando ? <LoaderCircle size={tamanhoIcone[t]} className="animate-spin" /> : Icone && <Icone size={tamanhoIcone[t]} />}
      {children}
    </button>
  )
}

const tamanhosQuadrado = { sm: 'h-8 w-8 rounded-lg', md: 'h-10 w-10 rounded-xl', lg: 'h-12 w-12 rounded-xl' }

/** Botão só com ícone. O rótulo vira aria-label e dica ao passar o mouse. */
export function IconeBotao({
  icone: Icone, rotulo, variante = 'fantasma', tamanho = 'md', className, type = 'button', ...props
}: Omit<ComponentProps<'button'>, 'children'> & {
  icone: LucideIcon
  rotulo: string
  variante?: VarianteBotao
  tamanho?: keyof typeof tamanhosQuadrado
}) {
  return (
    <button
      type={type}
      aria-label={rotulo}
      title={rotulo}
      {...props}
      className={cn(
        'inline-flex shrink-0 items-center justify-center transition-[opacity,background-color,color] outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40',
        tamanhosQuadrado[tamanho],
        variantes[variante],
        className,
      )}
    >
      <Icone size={tamanhoIcone[tamanho]} />
    </button>
  )
}
