import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  CalendarDays, CalendarPlus, LogIn, LogOut, Menu as IconeMenu, Settings, ShieldCheck, Trophy, Users, Wallet, type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { cn } from '../lib/cn'
import { supabase } from '../lib/supabase'
import { Avatar, Modal, useToast } from './ui'

interface ItemNav {
  para: string
  rotulo: string
  icone: LucideIcon
  fim?: boolean
}

const publicos: ItemNav[] = [
  { para: '/', rotulo: 'Prioridade', icone: Trophy, fim: true },
  { para: '/peladas', rotulo: 'Peladas', icone: CalendarDays },
]
const administracao: ItemNav[] = [
  { para: '/admin/financeiro', rotulo: 'Financeiro', icone: Wallet },
  { para: '/admin/jogadores', rotulo: 'Jogadores', icone: Users },
  { para: '/admin/novo-mes', rotulo: 'Novo mês', icone: CalendarPlus },
  { para: '/admin/config', rotulo: 'Configurações', icone: Settings },
]
/** No celular, estes ficam no sheet "Mais" para a barra inferior caber em 5 itens. */
const noMais = ['/admin/novo-mes', '/admin/config']

/** Páginas com tabelas e grades usam a largura maior. */
const largas = ['/peladas', '/admin/financeiro', '/admin/novo-mes']

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('flex items-center gap-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}>
      <svg viewBox="0 0 64 64" className="h-8 w-8 shrink-0" aria-hidden>
        <rect width="64" height="64" rx="16" fill="var(--color-primary)" />
        <g fill="none" stroke="var(--color-primary-foreground)" strokeWidth="4" strokeLinejoin="round">
          <rect x="12" y="17" width="40" height="30" rx="3" />
          <path d="M32 17v30" />
          <circle cx="32" cy="32" r="7" />
        </g>
      </svg>
      <span className="font-display text-lg font-bold">Pelada Fácil</span>
    </Link>
  )
}

export default function Layout() {
  const { admin, session } = useAuth()
  const { pathname } = useLocation()
  const [mais, setMais] = useState(false)
  const toast = useToast()

  useEffect(() => {
    window.scrollTo(0, 0)
    setMais(false)
  }, [pathname])

  const sair = async () => {
    await supabase.auth.signOut()
    toast.info('Você saiu da área do administrador')
  }

  const larga = largas.some((p) => pathname.startsWith(p))
  const barraInferior: (ItemNav & { onClick?: () => void; ativo?: boolean })[] = admin
    ? [
        ...publicos,
        ...administracao.filter((i) => !noMais.includes(i.para)),
        { para: '#mais', rotulo: 'Mais', icone: IconeMenu, onClick: () => setMais(true), ativo: noMais.some((p) => pathname.startsWith(p)) },
      ]
    : [...publicos, { para: '/entrar', rotulo: 'Admin', icone: ShieldCheck }]

  return (
    <div className="min-h-dvh">
      <a href="#conteudo" className="sr-only z-50 rounded-lg bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Pular para o conteúdo
      </a>

      {/* Desktop: menu lateral */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-card/40 lg:flex">
        <div className="px-5 pt-6 pb-8">
          <Logo />
        </div>
        <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3" aria-label="Principal">
          <GrupoNav titulo="Pelada" itens={publicos} />
          {admin && <GrupoNav titulo="Administração" itens={administracao} />}
        </nav>
        <div className="border-t border-border p-3">
          {session ? (
            <div className="flex items-center gap-3 rounded-xl px-2 py-2">
              <Avatar nome={session.user.email ?? 'Admin'} tamanho="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{session.user.email}</p>
                <p className="text-[11px] text-muted-foreground">{admin ? 'Administrador' : 'Sem acesso de admin'}</p>
              </div>
              <button
                onClick={sair}
                aria-label="Sair"
                title="Sair"
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <ItemLateral item={{ para: '/entrar', rotulo: 'Área do admin', icone: LogIn }} />
          )}
        </div>
      </aside>

      {/* Celular: barra superior */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Logo />
          {admin && (
            <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
              <ShieldCheck size={12} /> Admin
            </span>
          )}
        </div>
      </header>

      <main id="conteudo" className="lg:pl-60">
        <div className={cn('mx-auto px-4 pt-6 pb-28 sm:px-6 lg:px-8 lg:pt-10 lg:pb-16', larga ? 'max-w-6xl' : 'max-w-3xl')}>
          <Outlet />
        </div>
      </main>

      {/* Celular: barra inferior */}
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        <div className="mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${barraInferior.length}, minmax(0, 1fr))` }}>
          {barraInferior.map((i) =>
            i.onClick ? (
              <button key={i.para} onClick={i.onClick} className="outline-none" aria-haspopup="dialog">
                <ConteudoAba item={i} ativo={!!i.ativo} />
              </button>
            ) : (
              <NavLink key={i.para} to={i.para} end={i.fim} className="outline-none">
                {({ isActive }) => <ConteudoAba item={i} ativo={isActive} />}
              </NavLink>
            ),
          )}
        </div>
      </nav>

      <Modal aberto={mais} onFechar={() => setMais(false)} titulo="Mais opções" focoInicial={false}>
        <div className="-mx-2 -mt-1 flex flex-col gap-1">
          {administracao.filter((i) => noMais.includes(i.para)).map((i) => (
            <ItemLateral key={i.para} item={i} grande />
          ))}
          <div className="my-2 border-t border-border" />
          {session && (
            <button
              onClick={sair}
              className="flex h-12 items-center gap-3 rounded-xl px-3 text-base text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut size={18} /> Sair
            </button>
          )}
        </div>
      </Modal>
    </div>
  )
}

function ConteudoAba({ item: { icone: Icone, rotulo }, ativo }: { item: ItemNav; ativo: boolean }) {
  return (
    <span className={cn('flex flex-col items-center gap-1 pt-2 pb-1.5 transition-colors', ativo ? 'text-primary' : 'text-muted-foreground')}>
      <span className={cn('flex h-7 w-14 items-center justify-center rounded-full transition-colors', ativo && 'bg-primary/15')}>
        <Icone size={20} strokeWidth={ativo ? 2.25 : 2} />
      </span>
      <span className={cn('text-[11px]', ativo ? 'font-semibold' : 'font-medium')}>{rotulo}</span>
    </span>
  )
}

function GrupoNav({ titulo, itens }: { titulo: string; itens: ItemNav[] }) {
  return (
    <div>
      <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-muted-foreground/70 uppercase">{titulo}</p>
      <div className="flex flex-col gap-0.5">
        {itens.map((i) => <ItemLateral key={i.para} item={i} />)}
      </div>
    </div>
  )
}

function ItemLateral({ item: { para, rotulo, icone: Icone, fim }, grande }: { item: ItemNav; grande?: boolean }) {
  return (
    <NavLink
      to={para}
      end={fim}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-xl px-3 font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
          grande ? 'h-12 text-base' : 'h-10 text-sm',
          isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
        )
      }
    >
      <Icone size={grande ? 18 : 16} />
      {rotulo}
    </NavLink>
  )
}
