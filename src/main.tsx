import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import { AuthProvider, useAuth } from './lib/auth'
import { supabaseConfigurado } from './lib/supabase'
import Layout from './components/Layout'
import PrioridadePage from './pages/PrioridadePage'
import PeladasPage from './pages/PeladasPage'
import EntrarPage from './pages/EntrarPage'
import FinanceiroPage from './pages/admin/FinanceiroPage'
import NovoMesPage from './pages/admin/NovoMesPage'
import JogadoresPage from './pages/admin/JogadoresPage'
import ConfigPage from './pages/admin/ConfigPage'

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } } })

function SoAdmin({ children }: { children: ReactNode }) {
  const { admin, carregando } = useAuth()
  if (carregando) return null
  return admin ? children : <Navigate to="/entrar" replace />
}

function SemConfiguracao() {
  return (
    <div className="mx-auto max-w-lg p-8 text-neutral-300">
      <h1 className="mb-2 text-xl font-bold">Supabase não configurado</h1>
      <p>Copie <code>.env.example</code> para <code>.env.local</code>, preencha a URL e a anon key do projeto e reinicie o <code>npm run dev</code>.</p>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {!supabaseConfigurado ? (
      <SemConfiguracao />
    ) : (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<PrioridadePage />} />
                <Route path="peladas/:mesId?" element={<PeladasPage />} />
                <Route path="entrar" element={<EntrarPage />} />
                <Route path="admin/financeiro/:mesId?" element={<SoAdmin><FinanceiroPage /></SoAdmin>} />
                <Route path="admin/novo-mes" element={<SoAdmin><NovoMesPage /></SoAdmin>} />
                <Route path="admin/jogadores" element={<SoAdmin><JogadoresPage /></SoAdmin>} />
                <Route path="admin/config" element={<SoAdmin><ConfigPage /></SoAdmin>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    )}
  </StrictMode>,
)
