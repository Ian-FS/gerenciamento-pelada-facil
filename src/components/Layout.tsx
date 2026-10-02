import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

const link = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'}`

export default function Layout() {
  const { admin, session } = useAuth()
  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 pb-16">
      <header className="flex flex-wrap items-center gap-2 py-4">
        <span className="mr-2 text-lg font-bold">⚽ Pelada Fácil</span>
        <nav className="flex flex-wrap gap-1">
          <NavLink to="/" end className={link}>Prioridade</NavLink>
          <NavLink to="/peladas" className={link}>Peladas</NavLink>
          {admin && (
            <>
              <NavLink to="/admin/financeiro" className={link}>Financeiro</NavLink>
              <NavLink to="/admin/novo-mes" className={link}>Novo mês</NavLink>
              <NavLink to="/admin/jogadores" className={link}>Jogadores</NavLink>
              <NavLink to="/admin/config" className={link}>Configurações</NavLink>
            </>
          )}
        </nav>
        <div className="ml-auto">
          {session ? (
            <button className="text-sm text-neutral-400 hover:text-white" onClick={() => supabase.auth.signOut()}>
              Sair
            </button>
          ) : (
            <NavLink to="/entrar" className="text-sm text-neutral-500 hover:text-white">Admin</NavLink>
          )}
        </div>
      </header>
      <Outlet />
    </div>
  )
}
