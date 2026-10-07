import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link2, UserPlus } from 'lucide-react'
import { useSalvar } from '../lib/api'
import { listarJogadoresSorteio, parearPorNome } from '../lib/sorteio'
import { supabase } from '../lib/supabase'
import type { Jogador } from '../lib/types'
import { Botao, Card, Etiqueta, Select } from './ui'

/**
 * Liga cada jogador daqui ao seu cadastro no app Sorteio, onde ele vota nos dias de jogo.
 * Nome igual vincula com um clique; o resto o admin escolhe. Quem só existe no Sorteio
 * pode ser cadastrado aqui já vinculado.
 */
export function VinculoSorteio({ jogadores }: { jogadores: Jogador[] }) {
  const salvar = useSalvar()
  const [aberto, setAberto] = useState(false)
  const { data: sorteio, error, isLoading } = useQuery({ queryKey: ['jogadores-sorteio'], queryFn: listarJogadoresSorteio, enabled: aberto })

  const vinculados = jogadores.filter((j) => j.sorteio_id).length
  const cabecalho = (
    <div className="flex flex-wrap items-center gap-2">
      <Link2 size={16} className="text-primary" />
      <span className="font-semibold">Vínculo com o app Sorteio</span>
      <Etiqueta cor={vinculados === jogadores.length ? 'verde' : 'amarelo'}>{vinculados} de {jogadores.length} vinculados</Etiqueta>
      <Botao pequeno variante="fantasma" className="ml-auto" onClick={() => setAberto(!aberto)}>{aberto ? 'Fechar' : 'Gerenciar'}</Botao>
    </div>
  )
  if (!aberto) return <Card className="mb-4">{cabecalho}</Card>

  const usados = new Set(jogadores.map((j) => j.sorteio_id))
  const livresS = (sorteio ?? []).filter((s) => !usados.has(s.id))
  const semVinculo = jogadores.filter((j) => !j.sorteio_id).sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome))
  const pares = sorteio ? parearPorNome(jogadores, sorteio) : []

  const vincular = (jogadorId: string, sorteioId: string) =>
    salvar(supabase.from('jogadores').update({ sorteio_id: sorteioId }).eq('id', jogadorId))
  const vincularPares = () =>
    salvar(...pares.map((p) => supabase.from('jogadores').update({ sorteio_id: p.sorteioId }).eq('id', p.jogadorId)))
  const adicionar = (s: { id: string; nome: string }) => salvar(supabase.from('jogadores').insert({ nome: s.nome, sorteio_id: s.id }))

  return (
    <Card className="mb-4 space-y-3 text-sm">
      {cabecalho}
      {isLoading && <p className="text-xs text-muted-foreground">Lendo os jogadores do Sorteio…</p>}
      {error && <p className="text-xs text-destructive">Não foi possível ler o Sorteio: {(error as Error).message}</p>}

      {pares.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-primary/10 p-3">
          <span className="flex-1">{pares.length} jogadores têm o mesmo nome nos dois apps.</span>
          <Botao pequeno variante="primario" onClick={vincularPares}>Vincular {pares.length} pelo nome</Botao>
        </div>
      )}

      {sorteio && semVinculo.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-muted-foreground">Sem vínculo aqui ({semVinculo.length})</p>
          <ul className="space-y-1">
            {semVinculo.map((j) => (
              <li key={j.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate">{j.nome} {!j.ativo && <Etiqueta>inativo</Etiqueta>}</span>
                <Select className="w-48" value="" onChange={(e) => e.target.value && vincular(j.id, e.target.value)}>
                  <option value="">Vincular a…</option>
                  {livresS.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </Select>
              </li>
            ))}
          </ul>
        </div>
      )}

      {livresS.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-muted-foreground">Só no Sorteio ({livresS.length})</p>
          <ul className="space-y-1">
            {livresS.map((s) => (
              <li key={s.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate">{s.nome}</span>
                <Botao pequeno icone={UserPlus} onClick={() => adicionar(s)}>Adicionar aqui</Botao>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sorteio && semVinculo.length === 0 && livresS.length === 0 && (
        <p className="text-xs text-muted-foreground">Todos os jogadores estão vinculados.</p>
      )}
    </Card>
  )
}
