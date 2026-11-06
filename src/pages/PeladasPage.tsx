import { useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Copy, Lock, Send, Share2 } from 'lucide-react'
import { useBase, usePagamentos, useSalvar, type Base } from '../lib/api'
import { useAuth } from '../lib/auth'
import { calcularRateio, NOMES_MESES, nomeDia } from '../lib/calc'
import { montarLista } from '../lib/lista'
import { supabase } from '../lib/supabase'
import type { Participacao, Sabado, TipoParticipacao } from '../lib/types'
import { Botao, CabecalhoPagina, Card, Carregando, Etiqueta, IconeBotao, Modal, SeletorPeriodo, Textarea, useToast } from '../components/ui'

export default function PeladasPage() {
  const { data, error } = useBase()
  const { mesId } = useParams()
  const navegar = useNavigate()
  if (!data) return <Carregando erro={error} />
  if (data.meses.length === 0) return <p className="text-neutral-400">Nenhum mês cadastrado ainda.</p>

  const mes = data.meses.find((m) => m.id === mesId) ?? data.meses[data.meses.length - 1]
  const sabados = data.sabados.filter((s) => s.mes_id === mes.id)
  const semDia = data.participacoes.filter((p) => p.mes_id === mes.id && !p.sabado_id)
  const valorAvulso = calcularRateio(mes, data.participacoes.filter((p) => p.mes_id === mes.id)).valor_avulso_centavos

  return (
    <div>
      <CabecalhoPagina
        titulo="Peladas"
        descricao={
          <span className="flex flex-wrap items-center gap-2">
            Listas dos {sabados.length} {sabados.length === 1 ? 'dia' : 'dias'} de jogo de {NOMES_MESES[mes.mes - 1].toLowerCase()}
            {mes.encerrado && <Etiqueta icone={Lock}>Mês encerrado</Etiqueta>}
          </span>
        }
        acoes={<SeletorPeriodo className="w-full sm:w-auto" periodos={data.meses} valor={mes.id} onChange={(id) => navegar(`/peladas/${id}`)} />}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {sabados.map((s) => (
          <SabadoCard key={s.id} sabado={s} base={data} encerrado={mes.encerrado} valorAvulso={valorAvulso} />
        ))}
      </div>

      <AvulsosSemDia mesId={mes.id} parts={semDia} base={data} encerrado={mes.encerrado} />
    </div>
  )
}

function SabadoCard({ sabado, base, encerrado, valorAvulso }: { sabado: Sabado; base: Base; encerrado: boolean; valorAvulso: number | null }) {
  const { admin } = useAuth()
  const salvar = useSalvar()
  const [editando, setEditando] = useState(false)
  const [compartilhando, setCompartilhando] = useState(false)
  const pag = usePagamentos(admin && compartilhando)
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
    if (confirm(`Remover ${nome(p.jogador_id)} deste dia?`)) salvar(supabase.from('participacoes').delete().eq('id', p.id))
  }
  const proximaOrdem = Math.max(0, ...parts.filter((p) => p.ordem < 99).map((p) => p.ordem)) + 1

  const linha = (p: Participacao, i: number, acoes?: ReactNode) => (
    <li key={p.id} className="flex items-center gap-2 py-0.5">
      <span className="w-6 text-right text-xs text-neutral-500">{i + 1}</span>
      <span className={p.desistiu ? 'min-w-0 truncate text-neutral-500 line-through' : 'min-w-0 truncate'}>{nome(p.jogador_id)}</span>
      {p.observacao && <span title={p.observacao} className="cursor-help text-xs text-neutral-500">ⓘ</span>}
      {podeEditar && <span className="ml-auto flex shrink-0 gap-1">{acoes}<Botao pequeno variante="fantasma" onClick={() => remover(p)}>✕</Botao></span>}
    </li>
  )

  return (
    <Card>
      {/* Contador embaixo do título: na mesma linha que os botões não cabe no celular nem nos cards em 2 colunas. */}
      <div className="mb-2 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-bold">{nomeDia(sabado.data)}</h2>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <Etiqueta cor={abertas > 0 ? 'amarelo' : 'verde'}>
              {confirmados}/{sabado.vagas}
            </Etiqueta>
            {abertas > 0 && <span className="text-xs text-amber-400">{abertas} vaga(s)</span>}
          </div>
        </div>
        {admin && (
          <span className="flex shrink-0 gap-1">
            <IconeBotao tamanho="sm" icone={Share2} rotulo="Compartilhar lista" onClick={() => setCompartilhando(true)} />
            <Botao pequeno variante="fantasma" onClick={() => setEditando(!editando)}>
              {editando ? 'Concluir' : 'Editar'}
            </Botao>
          </span>
        )}
      </div>
      {/* Espera os pagamentos carregarem para o ✅ já sair certo no texto inicial. */}
      {compartilhando && (pag.data || pag.error) && (
        <CompartilharLista
          titulo={nomeDia(sabado.data)}
          onFechar={() => setCompartilhando(false)}
          texto={montarLista(base.config.template_lista, {
            data: sabado.data,
            vagas: sabado.vagas,
            confirmados: [...reservas, ...avulsos].map((p) => ({
              nome: nome(p.jogador_id),
              pago: p.tipo === 'reserva'
                ? !!pag.data?.rateio.some((r) => r.mes_id === sabado.mes_id && r.jogador_id === p.jogador_id && r.pago)
                : !!pag.data?.avulso.some((a) => a.participacao_id === p.id && a.pago),
            })),
            espera: espera.map((p) => nome(p.jogador_id)),
            valorAvulsoCentavos: valorAvulso,
          })}
        />
      )}
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

/** Mensagem pronta da lista do dia (template de Configurações), editável antes de copiar ou mandar no WhatsApp. */
function CompartilharLista({ titulo, texto: inicial, onFechar }: { titulo: string; texto: string; onFechar: () => void }) {
  const toast = useToast()
  const [texto, setTexto] = useState(inicial)
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto)
      toast.sucesso('Lista copiada')
    } catch {
      toast.erro('Não deu para copiar. Selecione o texto e copie à mão.')
    }
  }
  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo="Compartilhar lista"
      descricao={`${titulo} · dá para ajustar o texto antes de enviar`}
      focoInicial={false}
      rodape={
        <>
          <Botao icone={Copy} onClick={copiar}>Copiar</Botao>
          <Botao variante="primario" icone={Send} onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank')}>
            WhatsApp
          </Botao>
        </>
      }
    >
      <Textarea rows={18} value={texto} onChange={(e) => setTexto(e.target.value)} className="text-sm" />
    </Modal>
  )
}

/** Avulsos que jogaram no mês mas sem dia registrado (vindos da planilha). Cada participação = uma pelada. */
function AvulsosSemDia({ mesId, parts, base, encerrado }: { mesId: string; parts: Participacao[]; base: Base; encerrado: boolean }) {
  const { admin } = useAuth()
  const salvar = useSalvar()
  const [editando, setEditando] = useState(false)
  const [jogador, setJogador] = useState('')
  if (parts.length === 0 && !admin) return null

  const nome = (id: string) => base.jogadores.find((j) => j.id === id)?.nome ?? '?'
  const porJogador = [...new Set(parts.map((p) => p.jogador_id))]
    .map((id) => ({ id, nome: nome(id), itens: parts.filter((p) => p.jogador_id === id) }))
    .sort((a, b) => a.nome.localeCompare(b.nome))

  const adicionar = (jogador_id: string) =>
    salvar(supabase.from('participacoes').insert({ mes_id: mesId, sabado_id: null, jogador_id, tipo: 'avulso', ordem: 99 }))
  const removerUm = (itens: Participacao[]) => {
    const ultimo = itens[itens.length - 1]
    if (confirm(`Remover 1 avulso de ${nome(ultimo.jogador_id)}?`)) salvar(supabase.from('participacoes').delete().eq('id', ultimo.id))
  }
  const removerTodos = (id: string, itens: Participacao[]) => {
    if (confirm(`Remover todos os ${itens.length} avulso(s) sem dia de ${nome(id)}?`))
      salvar(supabase.from('participacoes').delete().in('id', itens.map((p) => p.id)))
  }

  return (
    <Card className="mt-4">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="font-semibold">Avulsos sem dia registrado</h2>
        <Etiqueta cor="azul">{parts.length}</Etiqueta>
        {admin && (
          <Botao pequeno variante="fantasma" className="ml-auto" onClick={() => setEditando(!editando)}>
            {editando ? 'Concluir' : 'Editar'}
          </Botao>
        )}
      </div>

      {!editando ? (
        <p className="text-sm text-neutral-400">
          {porJogador.length === 0 ? 'Nenhum.' : porJogador.map((j) => `${j.nome} (${j.itens.length})`).join(', ')}
        </p>
      ) : (
        <>
          <ul className="text-sm">
            {porJogador.map((j) => (
              <li key={j.id} className="flex items-center gap-2 py-0.5">
                <span>{j.nome}</span>
                <Etiqueta cor="azul">{j.itens.length}</Etiqueta>
                <span className="ml-auto flex gap-1">
                  <Botao pequeno onClick={() => removerUm(j.itens)} aria-label={`Remover 1 avulso de ${j.nome}`}>−</Botao>
                  <Botao pequeno onClick={() => adicionar(j.id)} aria-label={`Adicionar 1 avulso a ${j.nome}`}>+</Botao>
                  <Botao pequeno variante="fantasma" onClick={() => removerTodos(j.id, j.itens)} aria-label={`Remover ${j.nome}`}>✕</Botao>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-2 border-t border-neutral-800 pt-3">
            {encerrado && <p className="text-xs text-amber-400">Este mês está encerrado. Alterações mudam o histórico.</p>}
            <div className="flex flex-wrap gap-2">
              <select value={jogador} onChange={(e) => setJogador(e.target.value)} className="flex-1">
                <option value="">Adicionar jogador…</option>
                {base.jogadores.filter((j) => j.ativo && !porJogador.some((x) => x.id === j.id)).map((j) => (
                  <option key={j.id} value={j.id}>{j.nome}</option>
                ))}
              </select>
              <Botao variante="primario" disabled={!jogador} onClick={() => { adicionar(jogador); setJogador('') }}>
                Adicionar
              </Botao>
            </div>
          </div>
        </>
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
        Vagas neste dia
        <input type="number" min={1} defaultValue={vagas} className="w-20" onBlur={(e) => Number(e.target.value) !== vagas && onVagas(Number(e.target.value))} />
      </label>
    </div>
  )
}
