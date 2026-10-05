import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  CircleCheck, Clock, Coins, Info, Lock, LockOpen, Pencil, PiggyBank, Receipt, Settings2, Ticket, Users,
} from 'lucide-react'
import { useBase, usePagamentos, useSalvar } from '../../lib/api'
import { calcularRateio, formatarData, formatarReais } from '../../lib/calc'
import { cn } from '../../lib/cn'
import { supabase } from '../../lib/supabase'
import type { Mes } from '../../lib/types'
import {
  Avatar, BarraProgresso, Botao, CabecalhoPagina, Campo, Card, Carregando, CartaoMetrica, Etiqueta, Input,
  Modal, nomePeriodo, Segmentado, SeletorPeriodo, Textarea, useDialogos, Vazio,
} from '../../components/ui'

/** Aceita "1.200,50", "1200,50" e "1200.50". */
const reaisParaCentavos = (s: string) => {
  const t = s.trim().replace(/\s|R\$/g, '')
  return Math.round(Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t) * 100) || 0
}
const centavosParaInput = (c: number) => (c / 100).toFixed(2).replace('.', ',')
const numeroBR = (n: number) => String(n).replace('.', ',')
const comSinal = (c: number) => `${c > 0 ? '+' : '−'} ${formatarReais(Math.abs(c))}`

type Aba = 'rateio' | 'avulsos'
type Filtro = 'todos' | 'pendentes' | 'pagos'

export default function FinanceiroPage() {
  const { data, error } = useBase()
  const pag = usePagamentos(true)
  const salvar = useSalvar()
  const { perguntar } = useDialogos()
  const { mesId } = useParams()
  const navegar = useNavigate()
  const [aba, setAba] = useState<Aba>('rateio')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [editandoMes, setEditandoMes] = useState(false)

  // Caixa extra: avulsos pagos de todos os meses menos o que já foi usado para abater o campo
  const caixa = useMemo(() => {
    if (!data || !pag.data) return null
    const pagos = new Set(pag.data.avulso.filter((a) => a.pago).map((a) => a.participacao_id))
    let entradas = 0
    for (const m of data.meses) {
      const parts = data.participacoes.filter((p) => p.mes_id === m.id)
      const valor = calcularRateio(m, parts).valor_avulso_centavos ?? 0
      entradas += parts.filter((p) => p.tipo === 'avulso' && pagos.has(p.id)).length * valor
    }
    const saidas = data.meses.reduce((s, m) => s + m.abatimento_caixa_centavos, 0)
    return { entradas, saidas, saldo: entradas - saidas }
  }, [data, pag.data])

  if (!data || !pag.data || !caixa) return <Carregando erro={error ?? pag.error} />
  if (data.meses.length === 0) {
    return (
      <Card className="p-0">
        <Vazio icone={Receipt} titulo="Nenhum mês cadastrado" descricao="Crie o primeiro mês para começar o rateio." acao={<Link to="/admin/novo-mes"><Botao variante="primario">Criar mês</Botao></Link>} />
      </Card>
    )
  }

  const mes = data.meses.find((m) => m.id === mesId) ?? data.meses[data.meses.length - 1]
  const parts = data.participacoes.filter((p) => p.mes_id === mes.id)
  const rateio = calcularRateio(mes, parts)
  const nome = (id: string) => data.jogadores.find((j) => j.id === id)?.nome ?? '?'
  const dataSabado = (id: string | null) => (id ? data.sabados.find((s) => s.id === id)?.data ?? '' : '')

  const pagRateio = new Map(pag.data.rateio.filter((p) => p.mes_id === mes.id).map((p) => [p.jogador_id, p]))
  const pagAvulso = new Map(pag.data.avulso.map((p) => [p.participacao_id, p]))
  const valorAvulso = rateio.valor_avulso_centavos ?? 0

  const linhas = rateio.linhas
    .map((l) => {
      const p = pagRateio.get(l.jogador_id)
      const ajuste = p?.ajuste_centavos ?? 0
      return { ...l, nome: nome(l.jogador_id), pago: p?.pago ?? false, ajuste, total: l.valor_centavos + ajuste, obs: p?.observacao ?? '' }
    })
    .sort((a, b) => b.dias - a.dias || a.nome.localeCompare(b.nome))
  const avulsos = parts
    .filter((p) => p.tipo === 'avulso')
    .map((a) => ({ ...a, nome: nome(a.jogador_id), data: dataSabado(a.sabado_id), pago: pagAvulso.get(a.id)?.pago ?? false }))
    .sort((a, b) => (a.data || '9999').localeCompare(b.data || '9999') || a.nome.localeCompare(b.nome))

  const passa = (pago: boolean) => filtro === 'todos' || (filtro === 'pagos') === pago
  const totalRateio = linhas.reduce((s, l) => s + l.total, 0)
  const recebidoRateio = linhas.filter((l) => l.pago).reduce((s, l) => s + l.total, 0)
  const pagosRateio = linhas.filter((l) => l.pago).length
  const pagosAvulso = avulsos.filter((a) => a.pago).length

  const salvarRateio = (jogador_id: string, campos: Record<string, unknown>) =>
    salvar(supabase.from('pagamentos_rateio').upsert({ mes_id: mes.id, jogador_id, ...pagRateio.get(jogador_id), ...campos }))
  const alternarRateio = (l: (typeof linhas)[number]) =>
    salvarRateio(l.jogador_id, { pago: !l.pago, pago_em: l.pago ? null : new Date().toISOString() })
  const alternarAvulso = (participacao_id: string, pago: boolean) =>
    salvar(supabase.from('pagamentos_avulso').upsert({ participacao_id, pago, pago_em: pago ? new Date().toISOString() : null }))

  const editarAjuste = async (l: (typeof linhas)[number]) => {
    const r = await perguntar({
      titulo: `Ajuste de ${l.nome}`,
      descricao: `Cota calculada: ${formatarReais(l.valor_centavos)}. O ajuste soma ou desconta desse valor.`,
      campos: [
        { nome: 'valor', rotulo: 'Valor do ajuste', tipo: 'dinheiro', valor: l.ajuste ? centavosParaInput(l.ajuste) : '', placeholder: '0,00', dica: 'Use valor negativo para desconto (ex.: -10,00).' },
        { nome: 'motivo', rotulo: 'Motivo', tipo: 'longo', valor: l.obs, placeholder: 'Ex.: crédito do mês anterior' },
      ],
    })
    if (!r) return
    const v = reaisParaCentavos(r.valor)
    salvarRateio(l.jogador_id, { ajuste_centavos: v, observacao: v ? r.motivo || null : null })
  }

  const listaRateio = linhas.filter((l) => passa(l.pago))
  const listaAvulsos = avulsos.filter((a) => passa(a.pago))
  const gruposAvulsos = [...new Set(listaAvulsos.map((a) => a.data))].map((d) => ({ data: d, itens: listaAvulsos.filter((a) => a.data === d) }))

  return (
    <div className="space-y-4">
      <CabecalhoPagina
        titulo="Financeiro"
        descricao={
          <span className="flex flex-wrap items-center gap-2">
            Rateio e pagamentos de {nomePeriodo(mes).toLowerCase()}
            {mes.encerrado && <Etiqueta icone={Lock}>Mês encerrado</Etiqueta>}
          </span>
        }
        acoes={
          <div className="flex w-full gap-2 sm:w-auto">
            <SeletorPeriodo className="flex-1 sm:flex-none" periodos={data.meses} valor={mes.id} onChange={(id) => navegar(`/admin/financeiro/${id}`)} />
            <Botao icone={Settings2} className="h-auto" onClick={() => setEditandoMes(true)} aria-label="Dados do mês">
              <span className="hidden sm:inline">Dados do mês</span>
            </Botao>
          </div>
        }
      />

      {mes.observacao && (
        <button
          onClick={() => setEditandoMes(true)}
          className="flex w-full items-start gap-3 rounded-2xl border border-c-ambar/30 bg-c-ambar/10 px-4 py-3 text-left text-sm transition-colors hover:bg-c-ambar/15"
        >
          <Info size={16} className="mt-0.5 shrink-0 text-c-ambar" />
          <span className="flex-1 text-foreground/90">{mes.observacao}</span>
          <Pencil size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
        </button>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CartaoMetrica
          icone={Receipt}
          rotulo="Valor a ratear"
          valor={formatarReais(rateio.valor_liquido_centavos)}
          detalhe={mes.abatimento_caixa_centavos ? `Campo ${formatarReais(mes.custo_campo_centavos)} − caixa ${formatarReais(mes.abatimento_caixa_centavos)}` : 'Custo do campo'}
        />
        <CartaoMetrica
          icone={Coins}
          cor="amarelo"
          rotulo="Valor do ponto"
          valor={rateio.valor_ponto ? formatarReais(Math.round(rateio.valor_ponto)) : '—'}
          detalhe={`${numeroBR(rateio.total_pontos)} pontos na turma`}
        />
        <CartaoMetrica
          icone={Ticket}
          cor="azul"
          rotulo="Avulso por pelada"
          valor={rateio.valor_avulso_centavos ? formatarReais(valorAvulso) : '—'}
          detalhe={`Ponto × ${numeroBR(mes.avulso_multiplicador)}`}
        />
        <CartaoMetrica
          icone={PiggyBank}
          cor="roxo"
          rotulo="Caixa extra"
          valor={formatarReais(caixa.saldo)}
          detalhe={`Entrou ${formatarReais(caixa.entradas)} · usado ${formatarReais(caixa.saidas)}`}
        />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <Segmentado
            rotulo="Lista"
            className="w-full sm:w-auto"
            valor={aba}
            onChange={setAba}
            opcoes={[
              { valor: 'rateio', rotulo: <>Rateio <Contador n={linhas.length} /></>, icone: Users },
              { valor: 'avulsos', rotulo: <>Avulsos <Contador n={avulsos.length} /></>, icone: Ticket },
            ]}
          />
          <Segmentado
            rotulo="Filtrar por situação"
            className="w-full sm:w-auto"
            valor={filtro}
            onChange={setFiltro}
            opcoes={[
              { valor: 'todos', rotulo: 'Todos' },
              { valor: 'pendentes', rotulo: 'Pendentes' },
              { valor: 'pagos', rotulo: 'Pagos' },
            ]}
          />
        </div>

        {aba === 'rateio' ? (
          <Recebimento
            recebido={recebidoRateio}
            total={totalRateio}
            pagos={pagosRateio}
            quantidade={linhas.length}
          />
        ) : (
          <Recebimento
            recebido={pagosAvulso * valorAvulso}
            total={avulsos.length * valorAvulso}
            pagos={pagosAvulso}
            quantidade={avulsos.length}
            nota="vai para o caixa extra"
          />
        )}

        {aba === 'rateio' &&
          (listaRateio.length === 0 ? (
            <Vazio icone={Users} titulo={linhas.length ? 'Ninguém nesta situação' : 'Sem reservas neste mês'} />
          ) : (
            <>
              {/* Desktop: tabela */}
              <div className="hidden overflow-x-auto md:block">
                <table className="num w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Jogador</th>
                      <th className="px-3 py-2.5 text-center font-medium">Dias</th>
                      <th className="px-3 py-2.5 text-center font-medium">Peso</th>
                      <th className="px-3 py-2.5 text-right font-medium">Por pelada</th>
                      <th className="px-3 py-2.5 text-right font-medium">Cota</th>
                      <th className="px-3 py-2.5 text-right font-medium">Ajuste</th>
                      <th className="px-3 py-2.5 text-right font-medium">Total</th>
                      <th className="px-4 py-2.5 text-right font-medium">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listaRateio.map((l) => (
                      <tr key={l.jogador_id} className="border-b border-border/50 transition-colors last:border-0 hover:bg-secondary/30">
                        <td className="px-4 py-2">
                          <span className="flex items-center gap-3">
                            <Avatar nome={l.nome} tamanho="sm" />
                            <span className="font-medium">{l.nome}</span>
                          </span>
                        </td>
                        <td className="px-3 text-center">{l.dias}</td>
                        <td className="px-3 text-center text-muted-foreground">{l.peso.toFixed(2).replace('.', ',')}</td>
                        <td className="px-3 text-right text-muted-foreground">{formatarReais(l.valor_pelada_centavos)}</td>
                        <td className="px-3 text-right">{formatarReais(l.valor_centavos)}</td>
                        <td className="px-3 text-right">
                          <button
                            onClick={() => editarAjuste(l)}
                            title={l.obs || 'Adicionar ajuste'}
                            className={cn(
                              'group inline-flex h-8 items-center gap-1.5 rounded-lg px-2 transition-colors hover:bg-secondary',
                              l.ajuste ? (l.ajuste > 0 ? 'text-c-laranja' : 'text-c-esmeralda') : 'text-muted-foreground/60',
                            )}
                          >
                            {l.ajuste ? comSinal(l.ajuste) : '—'}
                            <Pencil size={12} className="opacity-0 transition-opacity group-hover:opacity-100" />
                          </button>
                        </td>
                        <td className="px-3 text-right font-semibold">{formatarReais(l.total)}</td>
                        <td className="px-4 text-right">
                          <StatusPago pago={l.pago} onClick={() => alternarRateio(l)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {filtro === 'todos' && (
                    <tfoot>
                      <tr className="border-t border-border bg-secondary/30 text-sm">
                        <td className="px-4 py-3 font-medium">Total</td>
                        <td className="px-3 text-center text-muted-foreground">{linhas.reduce((s, l) => s + l.dias, 0)}</td>
                        <td />
                        <td />
                        <td className="px-3 text-right">{formatarReais(linhas.reduce((s, l) => s + l.valor_centavos, 0))}</td>
                        <td className="px-3 text-right text-muted-foreground">
                          {(() => { const a = linhas.reduce((s, l) => s + l.ajuste, 0); return a ? comSinal(a) : '—' })()}
                        </td>
                        <td className="px-3 text-right font-semibold">{formatarReais(totalRateio)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Celular: lista */}
              <ul className="divide-y divide-border/50 md:hidden">
                {listaRateio.map((l) => (
                  <li key={l.jogador_id} className="flex items-center gap-3 px-4 py-3">
                    <Avatar nome={l.nome} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{l.nome}</p>
                      <p className="num text-xs text-muted-foreground">
                        {l.dias} {l.dias === 1 ? 'dia' : 'dias'} · {formatarReais(l.valor_pelada_centavos)}/pelada
                      </p>
                      <button
                        onClick={() => editarAjuste(l)}
                        className={cn('num mt-0.5 inline-flex items-center gap-1 text-xs', l.ajuste ? (l.ajuste > 0 ? 'text-c-laranja' : 'text-c-esmeralda') : 'text-muted-foreground/70')}
                      >
                        <Pencil size={11} /> {l.ajuste ? `Ajuste ${comSinal(l.ajuste)}` : 'Ajustar'}
                      </button>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="num font-semibold">{formatarReais(l.total)}</span>
                      <StatusPago pago={l.pago} onClick={() => alternarRateio(l)} />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ))}

        {aba === 'avulsos' &&
          (listaAvulsos.length === 0 ? (
            <Vazio
              icone={Ticket}
              titulo={avulsos.length ? 'Ninguém nesta situação' : 'Nenhum avulso neste mês'}
              descricao={!avulsos.length && <>Avulsos são adicionados na página <Link className="text-primary underline-offset-2 hover:underline" to={`/peladas/${mes.id}`}>Peladas</Link>.</>}
            />
          ) : (
            gruposAvulsos.map((g) => (
              <section key={g.data || 'sem-dia'}>
                <h3 className="flex items-center justify-between bg-secondary/30 px-4 py-2 text-xs font-medium text-muted-foreground">
                  <span>{g.data ? `Sábado ${formatarData(g.data)}` : 'Dia não registrado'}</span>
                  <span>{g.itens.length} {g.itens.length === 1 ? 'avulso' : 'avulsos'}</span>
                </h3>
                <ul className="divide-y divide-border/50">
                  {g.itens.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                      <Avatar nome={a.nome} tamanho="sm" />
                      <span className="min-w-0 flex-1 truncate font-medium">{a.nome}</span>
                      <span className="num text-sm text-muted-foreground">{formatarReais(valorAvulso)}</span>
                      <StatusPago pago={a.pago} onClick={() => alternarAvulso(a.id, !a.pago)} />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          ))}
      </Card>

      <DadosDoMes key={mes.id + String(editandoMes)} aberto={editandoMes} onFechar={() => setEditandoMes(false)} mes={mes} saldoCaixa={caixa.saldo} />
    </div>
  )
}

function Contador({ n }: { n: number }) {
  return <span className="num rounded-full bg-background/60 px-1.5 text-[10px] text-muted-foreground">{n}</span>
}

function Recebimento({
  recebido, total, pagos, quantidade, nota,
}: { recebido: number; total: number; pagos: number; quantidade: number; nota?: string }) {
  if (!quantidade) return null
  return (
    <div className="border-b border-border px-4 py-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
        <span>
          <span className="num font-semibold">{formatarReais(recebido)}</span>
          <span className="text-muted-foreground"> recebidos de {formatarReais(total)}</span>
          {nota && <span className="text-muted-foreground"> · {nota}</span>}
        </span>
        <span className="num text-xs text-muted-foreground">{pagos} de {quantidade} pagos</span>
      </div>
      <BarraProgresso valor={recebido} max={total} rotulo="Valor recebido" />
    </div>
  )
}

function StatusPago({ pago, onClick }: { pago: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={pago}
      title={pago ? 'Marcar como pendente' : 'Marcar como pago'}
      className={cn(
        'inline-flex h-8 w-28 items-center justify-center gap-1.5 rounded-full text-xs font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
        pago ? 'bg-primary/15 text-primary hover:bg-primary/25' : 'bg-c-ambar/15 text-c-ambar hover:bg-c-ambar/25',
      )}
    >
      {pago ? <CircleCheck size={14} /> : <Clock size={14} />}
      {pago ? 'Pago' : 'Pendente'}
    </button>
  )
}

/** Modal com os dados editáveis do mês: custo, abatimento, observação e encerramento. */
function DadosDoMes({ aberto, onFechar, mes, saldoCaixa }: { aberto: boolean; onFechar: () => void; mes: Mes; saldoCaixa: number }) {
  const salvar = useSalvar()
  const { confirmar } = useDialogos()
  const [custo, setCusto] = useState(centavosParaInput(mes.custo_campo_centavos))
  const [abatimento, setAbatimento] = useState(centavosParaInput(mes.abatimento_caixa_centavos))
  const [obs, setObs] = useState(mes.observacao ?? '')
  const [salvando, setSalvando] = useState(false)

  const novoAbatimento = reaisParaCentavos(abatimento)
  // O saldo já desconta o abatimento atual deste mês; o que importa é a diferença.
  const disponivel = saldoCaixa + mes.abatimento_caixa_centavos
  const excede = novoAbatimento > disponivel
  const liquido = reaisParaCentavos(custo) - novoAbatimento

  const gravar = async (e: FormEvent) => {
    e.preventDefault()
    if (excede && !(await confirmar({
      titulo: 'Abatimento maior que o caixa',
      descricao: `O caixa extra tem ${formatarReais(disponivel)} disponíveis para este mês. Salvar mesmo assim?`,
      confirmar: 'Salvar mesmo assim',
    }))) return
    setSalvando(true)
    try {
      await salvar(supabase.from('meses').update({
        custo_campo_centavos: reaisParaCentavos(custo),
        abatimento_caixa_centavos: novoAbatimento,
        observacao: obs.trim() || null,
      }).eq('id', mes.id))
      onFechar()
    } finally {
      setSalvando(false)
    }
  }

  const alternarEncerrado = async () => {
    const ok = await confirmar(mes.encerrado
      ? { titulo: `Reabrir ${nomePeriodo(mes).toLowerCase()}?`, descricao: 'O mês volta a aceitar alterações normalmente.', confirmar: 'Reabrir mês' }
      : { titulo: `Encerrar ${nomePeriodo(mes).toLowerCase()}?`, descricao: 'Use quando todos os pagamentos estiverem resolvidos. Dá para reabrir depois se precisar.', confirmar: 'Encerrar mês' })
    if (!ok) return
    await salvar(supabase.from('meses').update({ encerrado: !mes.encerrado }).eq('id', mes.id))
    onFechar()
  }

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo="Dados do mês"
      descricao={nomePeriodo(mes)}
      focoInicial={false}
      rodape={
        <>
          <Botao variante="fantasma" onClick={onFechar}>Cancelar</Botao>
          <Botao type="submit" form="dados-mes" variante="primario" carregando={salvando}>Salvar</Botao>
        </>
      }
    >
      <form id="dados-mes" onSubmit={gravar} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Custo do campo">
            <Input prefixo="R$" inputMode="decimal" value={custo} onChange={(e) => setCusto(e.target.value)} />
          </Campo>
          <Campo
            rotulo="Abater do caixa extra"
            erro={excede ? `Maior que o disponível (${formatarReais(disponivel)})` : undefined}
            dica={`Disponível: ${formatarReais(disponivel)}`}
          >
            <Input prefixo="R$" inputMode="decimal" value={abatimento} onChange={(e) => setAbatimento(e.target.value)} />
          </Campo>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-secondary/50 px-3 py-2.5 text-sm">
          <span className="text-muted-foreground">Valor a ratear</span>
          <span className="num font-semibold">{formatarReais(liquido)}</span>
        </div>
        <Campo rotulo="Observação" dica="Aparece em destaque no topo do Financeiro.">
          <Textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: campo mais caro por causa do feriado" />
        </Campo>

        <div className="mt-1 flex items-center gap-3 rounded-xl border border-border p-3">
          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', mes.encerrado ? 'bg-secondary text-muted-foreground' : 'bg-primary/10 text-primary')}>
            {mes.encerrado ? <Lock size={16} /> : <LockOpen size={16} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{mes.encerrado ? 'Mês encerrado' : 'Mês aberto'}</p>
            <p className="text-xs text-muted-foreground">
              {mes.encerrado ? 'Alterações nas listas mudam o histórico.' : 'Encerre quando todos os pagamentos estiverem resolvidos.'}
            </p>
          </div>
          <Botao tamanho="sm" variante={mes.encerrado ? 'secundario' : 'contorno'} icone={mes.encerrado ? LockOpen : Lock} onClick={alternarEncerrado}>
            {mes.encerrado ? 'Reabrir' : 'Encerrar'}
          </Botao>
        </div>
      </form>
    </Modal>
  )
}
