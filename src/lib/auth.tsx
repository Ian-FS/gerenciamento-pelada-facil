import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigurado } from './supabase'

interface Auth {
  session: Session | null
  admin: boolean
  carregando: boolean
}
const AuthContext = createContext<Auth>({ session: null, admin: false, carregando: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [admin, setAdmin] = useState(false)
  const [carregando, setCarregando] = useState(supabaseConfigurado)

  useEffect(() => {
    if (!supabaseConfigurado) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabaseConfigurado) return
    if (!session) {
      setAdmin(false)
      setCarregando(false)
      return
    }
    supabase.rpc('is_admin').then(({ data }) => {
      setAdmin(data === true)
      setCarregando(false)
    })
  }, [session])

  return <AuthContext.Provider value={{ session, admin, carregando }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
