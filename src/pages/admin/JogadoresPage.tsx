import { useState } from 'react'
import { useBase, useSalvar } from '../../lib/api'
import { calcularPrioridade } from '../../lib/calc'
import { supabase } from '../../lib/supabase'
import type { Jogador } from '../../lib/types'
import { sorteioConfigurado } from '../../lib/sorteio'
import { Botao, Card, Carregando, Etiqueta, Titulo } from '../../components/ui'
import { VinculoSorteio } from '../../components/VinculoSorteio'

export default function JogadoresPage() {
  const { data, error } = useBase()
  const salvar = useSalvar()
  const [novo, setNovo] = useState('')
  const [aberto, setAberto] = useState<string | null>(null)
  if (!data) return <Carregando erro={error} />

  const prio = calcularPrioridade(data.participacoes, data.sabados, data.ajustes)
  const contagem = (id: string, tipo: string) => data.participacoes.filter((p) => p.jogador_id === id && p.tipo === tipo).length

  const adicionar = async () => {
    const nome = novo.trim()
    if (!nome) return
    await salvar(supabase.from('jogadores').insert({ nome }))
    setNovo('')
  }
  const renomear = (j: Jogador) => {
    const nome = prompt('Novo nome:', j.nome)?.trim()
    if (nome && nome !== j.nome) salvar(supabase.from('jogadores').update({ nome }).eq('id', j.id))
  }
  const zerar = (j: Jogador) => {
    const motivo = prompt(`Zerar a prioridade de ${j.nome}? As reservas anteriores a hoje deixam de contar.\nMotivo:`, 'Saiu e voltou para a pelada')
    if (motivo !== null) salvar(supabase.from('ajustes_prioridade').insert({ jogador_id: j.id, tipo: 'zerar', motivo }))
  }
  const ajustar = (j: Jogador) => {
    const valor = Number(prompt(`Quantos pontos somar (use negativo para tirar) na prioridade de ${j.nome}?`, '0'))
    if (!valor) return
    const motivo = prompt('Motivo:') ?? null
    salvar(supabase.from('ajustes_prioridade').insert({ jogador_id: j.id, tipo: 'ajuste', valor, motivo }))
  }
  const removerAjuste = (id: string) => {
    if (confirm('Remover este ajuste?')) salvar(supabase.from('ajustes_prioridade').delete().eq('id', id))
  }

  return (
    <div>
      <Titulo>Jogadores ({data.jogadores.length})</Titulo>
      <Card className="mb-4 flex gap-2">
        <input className="flex-1" placeholder="Nome do novo jogador" value={novo} onChange={(e) => setNovo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && adicionar()} />
        <Botao variante="primario" onClick={adicionar}>Adicionar</Botao>
      </Card>
      {sorteioConfigurado && <VinculoSorteio jogadores={data.jogadores} />}
      <div className="grid gap-2 md:grid-cols-2">
        {data.jogadores.map((j) => {
          const p = prio.get(j.id)
          const ajustes = data.ajustes.filter((a) => a.jogador_id === j.id).sort((a, b) => a.data.localeCompare(b.data))
          return (
            <Card key={j.id} className={j.ativo ? '' : 'opacity-50'}>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-800 font-bold" title="Pontos de prioridade">
                  {p?.pontos ?? 0}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{j.nome} {!j.ativo && <Etiqueta>inativo</Etiqueta>}</div>
                  <div className="text-xs text-neutral-400">
                    {contagem(j.id, 'reserva')} reservas · {contagem(j.id, 'avulso')} avulsos · {contagem(j.id, 'espera')} espera
                  </div>
                </div>
                <Botao pequeno variante="fantasma" onClick={() => setAberto(aberto === j.id ? null : j.id)}>⋮</Botao>
              </div>
              {aberto === j.id && (
                <div className="mt-3 space-y-2 border-t border-neutral-800 pt-3">
                  <div className="flex flex-wrap gap-2">
                    <Botao pequeno onClick={() => renomear(j)}>Renomear</Botao>
                    <Botao pequeno onClick={() => salvar(supabase.from('jogadores').update({ ativo: !j.ativo }).eq('id', j.id))}>
                      {j.ativo ? 'Desativar' : 'Reativar'}
                    </Botao>
                    {j.sorteio_id && (
                      <Botao pequeno onClick={() => confirm(`Desvincular ${j.nome} do app Sorteio?`) && salvar(supabase.from('jogadores').update({ sorteio_id: null }).eq('id', j.id))}>
                        Desvincular do Sorteio
                      </Botao>
                    )}
                    <Botao pequeno onClick={() => ajustar(j)}>Ajustar prioridade</Botao>
                    <Botao pequeno variante="perigo" onClick={() => zerar(j)}>Zerar prioridade</Botao>
                  </div>
                  {ajustes.length > 0 && (
                    <ul className="text-xs text-neutral-400">
                      {ajustes.map((a) => (
                        <li key={a.id} className="flex items-center gap-2">
                          {a.data.split('-').reverse().join('/')} ·{' '}
                          {a.tipo === 'zerar' ? 'zerado' : `${a.valor > 0 ? '+' : ''}${a.valor} pts`}
                          {a.motivo && ` · ${a.motivo}`}
                          <button className="ml-auto text-red-400" onClick={() => removerAjuste(a.id)}>remover</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
