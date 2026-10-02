import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useBase, useSalvar, type Base } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatarData, NOMES_MESES } from '../lib/calc'
import { supabase } from '../lib/supabase'
import type { Participacao, Sabado, TipoParticipacao } from '../lib/types'
import { Botao, Card, Carregando, Etiqueta, Titulo } from '../components/ui'

export default function PeladasPage() {
  const { data, error } = useBase()
  const { mesId } = useParams()
  if (!data) return <Carregando erro={error} />
  if (data.meses.length === 0) return <p className="text-neutral-400">Nenhum mês cadastrado ainda.</p>

  const mes = data.meses.find((m) => m.id === mesId) ?? data.meses[data.meses.length - 1]
  const sabados = data.sabados.filter((s) => s.mes_id === mes.id)
  const semDia = data.participacoes.filter((p) => p.mes_id === mes.id && !p.sabado_id)
  const nome = (id: string) => data.jogadores.find((j) => j.id === id)?.nome ?? '?'

  return (
    <div>
      <Titulo
        extra={
          <div className="flex flex-wrap gap-1">
            {[...data.meses].reverse().map((m) => (
              <Link
                key={m.id}
                to={`/peladas/${m.id}`}
                className={`rounded-lg px-2.5 py-1 text-sm ${m.id === mes.id ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}
              >
                {NOMES_MESES[m.mes - 1].slice(0, 3)}/{String(m.ano).slice(2)}
              </Link>
            ))}
          </div>
        }
      >
        Peladas de {NOMES_MESES[mes.mes - 1]}/{mes.ano}
      </Titulo>

      <div className="grid gap-4 md:grid-cols-2">
        {sabados.map((s) => (
          <SabadoCard key={s.id} sabado={s} base={data} encerrado={mes.encerrado} />
        ))}
      </div>

      {semDia.length > 0 && (
        <Card className="mt-4">
          <h2 className="mb-2 font-semibold">Avulsos sem dia registrado</h2>
          <p className="text-sm text-neutral-400">
            {[...new Set(semDia.map((p) => p.jogador_id))]
              .map((id) => `${nome(id)} (${semDia.filter((p) => p.jogador_id === id).length})`)
              .join(', ')}
          </p>
        </Card>
      )}
    </div>
  )
}

function SabadoCard({ sabado, base, encerrado }: { sabado: Sabado; base: Base; encerrado: boolean }) {
  const { admin } = useAuth()
  const salvar = useSalvar()
  const [editando, setEditando] = useState(false)
  const parts = base.participacoes.filter((p) => p.sabado_id === sabado.id)
  const nome = (id: string) => base.jogadores.find((j) => j.id === id)?.nome ?? '?'

  const reservas = parts.filter((p) => p.tipo === 'reserva' && !p.desistiu)
  const avulsos = parts.filter((p) => p.tipo === 'avulso')
  const desistencias = parts.filter((p) => p.tipo === 'reserva' && p.desistiu)
  const espera = parts.filter((p) => p.tipo === 'espera')
  const confirmados = reservas.length + avulsos.length
  const abertas = sabado.vagas - confirmados
  const podeEditar = admin && editando

  const atualizar = (p: Participacao, campos: Partial<Participacao>) =>
    salvar(supabase.from('participacoes').update(campos).eq('id', p.id))
  const remover = (p: Participacao) => {
    if (confirm(`Remover ${nome(p.jogador_id)} deste sábado?`)) salvar(supabase.from('participacoes').delete().eq('id', p.id))
  }
  const proximaOrdem = Math.max(0, ...parts.filter((p) => p.ordem < 99).map((p) => p.ordem)) + 1

  const linha = (p: Participacao, i: number, acoes?: ReactNode) => (
    <li key={p.id} className="flex items-center gap-2 py-0.5">
      <span className="w-6 text-right text-xs text-neutral-500">{i + 1}</span>
      <span className={p.desistiu ? 'text-neutral-500 line-through' : ''}>{nome(p.jogador_id)}</span>
      {p.observacao && <span title={p.observacao} className="cursor-help text-xs text-neutral-500">ⓘ</span>}
      {podeEditar && <span className="ml-auto flex gap-1">{acoes}<Botao pequeno variante="fantasma" onClick={() => remover(p)}>✕</Botao></span>}
    </li>
  )

  return (
    <Card>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-lg font-bold">Sábado {formatarData(sabado.data)}</h2>
        <Etiqueta cor={abertas > 0 ? 'amarelo' : 'verde'}>
          {confirmados}/{sabado.vagas}
        </Etiqueta>
        {abertas > 0 && <span className="text-xs text-amber-400">{abertas} vaga(s)</span>}
        {admin && (
          <Botao pequeno variante="fantasma" className="ml-auto" onClick={() => setEditando(!editando)}>
            {editando ? 'Concluir' : 'Editar'}
          </Botao>
        )}
      </div>
      {sabado.observacao && <p className="mb-2 text-xs text-neutral-400">{sabado.observacao}</p>}

      <Secao titulo="Reservas" qtd={reservas.length}>
        {reservas.map((p, i) =>
          linha(p, i, <Botao pequeno onClick={() => atualizar(p, { desistiu: true })}>Desistiu</Botao>),
        )}
      </Secao>

      {(avulsos.length > 0 || podeEditar) && (
        <Secao titulo="Avulsos" qtd={avulsos.length} cor="azul">
          {avulsos.map((p, i) =>
            linha(p, reservas.length + i, <Botao pequeno onClick={() => atualizar(p, { tipo: 'espera', ordem: proximaOrdem })}>→ Espera</Botao>),
          )}
        </Secao>
      )}

      {desistencias.length > 0 && (
        <Secao titulo="Desistiram (já pagaram)" qtd={desistencias.length} cor="vermelho">
          {desistencias.map((p, i) => linha(p, i, <Botao pequeno onClick={() => atualizar(p, { desistiu: false })}>Desfazer</Botao>))}
        </Secao>
      )}

      {(espera.length > 0 || podeEditar) && (
        <Secao titulo="Lista de espera" qtd={espera.length} cor="amarelo">
          {espera.map((p, i) =>
            linha(p, i, <Botao pequeno variante="primario" onClick={() => atualizar(p, { tipo: 'avulso' })}>Entrar avulso</Botao>),
          )}
        </Secao>
      )}

      {podeEditar && (
        <AdicionarJogador
          base={base}
          jaNaLista={new Set(parts.map((p) => p.jogador_id))}
          onAdicionar={(jogador_id, tipo) =>
            salvar(supabase.from('participacoes').insert({ mes_id: sabado.mes_id, sabado_id: sabado.id, jogador_id, tipo, ordem: proximaOrdem }))
          }
          vagas={sabado.vagas}
          onVagas={(vagas) => salvar(supabase.from('sabados').update({ vagas }).eq('id', sabado.id))}
          encerrado={encerrado}
        />
      )}
    </Card>
  )
}

function Secao({ titulo, qtd, cor = 'verde', children }: { titulo: string; qtd: number; cor?: 'verde' | 'azul' | 'amarelo' | 'vermelho'; children: ReactNode }) {
  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
        {titulo} <Etiqueta cor={cor}>{qtd}</Etiqueta>
      </div>
      <ul className="text-sm">{children}</ul>
    </div>
  )
}

function AdicionarJogador({
  base, jaNaLista, onAdicionar, vagas, onVagas, encerrado,
}: {
  base: Base
  jaNaLista: Set<string>
  onAdicionar: (jogadorId: string, tipo: TipoParticipacao) => void
  vagas: number
  onVagas: (v: number) => void
  encerrado: boolean
}) {
  const [jogador, setJogador] = useState('')
  const [tipo, setTipo] = useState<TipoParticipacao>('avulso')
  const disponiveis = base.jogadores.filter((j) => j.ativo && !jaNaLista.has(j.id))
  return (
    <div className="mt-3 space-y-2 border-t border-neutral-800 pt-3">
      {encerrado && <p className="text-xs text-amber-400">Este mês está encerrado. Alterações mudam o histórico.</p>}
      <div className="flex flex-wrap gap-2">
        <select value={jogador} onChange={(e) => setJogador(e.target.value)} className="flex-1">
          <option value="">Adicionar jogador…</option>
          {disponiveis.map((j) => <option key={j.id} value={j.id}>{j.nome}</option>)}
        </select>
        <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoParticipacao)}>
          <option value="avulso">Avulso</option>
          <option value="espera">Lista de espera</option>
          <option value="reserva">Reserva</option>
        </select>
        <Botao variante="primario" disabled={!jogador} onClick={() => { onAdicionar(jogador, tipo); setJogador('') }}>
          Adicionar
        </Botao>
      </div>
      <label className="flex items-center gap-2 text-sm text-neutral-400">
        Vagas neste sábado
        <input type="number" min={1} defaultValue={vagas} className="w-20" onBlur={(e) => Number(e.target.value) !== vagas && onVagas(Number(e.target.value))} />
      </label>
    </div>
  )
}
