import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { Botao, Card, Rotulo, Titulo } from '../components/ui'

export default function EntrarPage() {
  const { session, admin, carregando } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')

  if (session && admin) return <Navigate to="/admin/financeiro" replace />

  const entrar = async (e: FormEvent) => {
    e.preventDefault()
    setErro('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) setErro('E-mail ou senha inválidos.')
  }

  return (
    <div className="mx-auto max-w-sm">
      <Titulo>Área do administrador</Titulo>
      <Card>
        {session && !admin && !carregando ? (
          <p className="text-sm text-amber-400">Você entrou, mas este usuário não é administrador. Veja o README para liberar o acesso.</p>
        ) : (
          <form onSubmit={entrar} className="space-y-3">
            <Rotulo texto="E-mail"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Rotulo>
            <Rotulo texto="Senha"><input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required /></Rotulo>
            {erro && <p className="text-sm text-red-400">{erro}</p>}
            <Botao variante="primario" className="w-full" type="submit">Entrar</Botao>
          </form>
        )}
      </Card>
    </div>
  )
}
