import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarPlus, Check, ClipboardList, Hand, ListChecks, Pencil, Scale, Undo2, Vote } from 'lucide-react'
import { useBase, useSalvar, type Base } from '../../lib/api'
import {
  calcularPrioridade, compararPrioridade, distribuirReservas, formatarReais, diasDoMes, gruposEmpate, inicioDoMes, nomeDia, rotuloDia,
} from '../../lib/calc'
import { cn } from '../../lib/cn'
import { supabase } from '../../lib/supabase'
import { aplicarVotos, sorteioConfigurado } from '../../lib/sorteio'
import {
  Botao, CabecalhoPagina, Campo, Card, CardCabecalho, Carregando, Etiqueta, Input, nomePeriodo, Segmentado, SeletorPeriodo, useDialogos,
} from '../../components/ui'
import { SeletorDias } from '../../components/SeletorDias'
import { PendenciasImportacao, VotacaoSorteio, type ResultadoImportacao } from '../../components/VotacaoSorteio'

type Modo = 'votacao' | 'manual'
interface AnoMes { ano: number; mes: number }

const seguinte = ({ ano, mes }: AnoMes): AnoMes => (mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 })
const idPeriodo = ({ ano, mes }: AnoMes) => `${ano}-${String(mes).padStart(2, '0')}`

export default function NovoMesPage() {
  const { data, error } = useBase()
  if (!data) return <Carregando erro={error} />
  return <Formulario base={data} />
}

function Formulario({ base }: { base: Base }) {
  const salvar = useSalvar()
  const navegar = useNavigate()
  const { confirmar } = useDialogos()

  // Meses que dá para criar: do mês atual (ou do seguinte ao último criado, se vier antes) em diante,
  // pulando os que já existem — inclusive um que tenha sido excluído no meio.
  const periodos = useMemo(() => {
    const hoje = { ano: new Date().getFullYear(), mes: new Date().getMonth() + 1 }
    const ultimo = base.meses[base.meses.length - 1]
    const depoisDoUltimo = ultimo ? seguinte(ultimo) : hoje
    let p = idPeriodo(hoje) < idPeriodo(depoisDoUltimo) ? hoje : depoisDoUltimo
    const out: (AnoMes & { id: string })[] = []
    for (let i = 0; i < 13; i++, p = seguinte(p)) {
      if (!base.meses.some((m) => m.ano === p.ano && m.mes === p.mes)) out.push({ id: idPeriodo(p), ...p })
    }
    return { lista: out, padrao: out.find((x) => x.id === idPeriodo(depoisDoUltimo)) ?? out[0] }
  }, [base.meses])

  const [periodo, setPeriodo] = useState<AnoMes>(() => periodos.padrao ?? { ano: new Date().getFullYear(), mes: new Date().getMonth() + 1 })
  const { ano, mes } = periodo
  const [modo, setModo] = useState<Modo>(sorteioConfigurado ? 'votacao' : 'manual')
  const [custo, setCusto] = useState(String(base.config.custo_campo_padrao_centavos / 100))
  const [vagas, setVagas] = useState(base.config.vagas_padrao)
  const diasPadrao = base.config.dias_semana_padrao
  const [datas, setDatas] = useState(() => diasDoMes(ano, mes, diasPadrao))
  const [pedidos, setPedidos] = useState<Record<string, string[]>>({}) // data -> jogadores
  const [desempate, setDesempate] = useState<string[]>([]) // ordem escolhida pelo admin para empates
  const [importacao, setImportacao] = useState<(ResultadoImportacao & { em: string }) | null>(null)
  // Pedidos exatamente como vieram da votação (inclui pendências resolvidas), para mostrar os ajustes.
  const [votados, setVotados] = useState<Record<string, string[]>>({})
  const [ajustando, setAjustando] = useState(false)
  const [criando, setCriando] = useState(false)

  const jaExiste = base.meses.some((m) => m.ano === ano && m.mes === mes)
  const ativos = base.jogadores.filter((j) => j.ativo)
  const nome = (id: string) => base.jogadores.find((j) => j.id === id)?.nome ?? '?'
  const custoCentavos = Math.round(Number(custo.replace(',', '.')) * 100) || 0

  const prioridade = useMemo(
    () => calcularPrioridade(base.participacoes, base.sabados, base.ajustes, inicioDoMes(ano, mes), base.meses),
    [base, ano, mes],
  )
  const pontos = (id: string) => prioridade.get(id)?.pontos ?? 0

  const recomecar = (p: AnoMes) => {
    setDatas(diasDoMes(p.ano, p.mes, diasPadrao))
    setPedidos({})
    setDesempate([])
    setImportacao(null)
    setVotados({})
    setAjustando(false)
  }
  const mudarMes = (id: string) => {
    const p = periodos.lista.find((x) => x.id === id)
    if (!p) return
    setPeriodo(p)
    recomecar(p)
  }
  const trocarModo = async (m: Modo) => {
    if (m === modo) return
    const temPedidos = Object.values(pedidos).some((l) => l.length > 0)
    if (temPedidos && !(await confirmar({
      titulo: 'Trocar o jeito de montar os pedidos?',
      descricao: 'Os pedidos marcados até agora serão descartados.',
      confirmar: 'Trocar e descartar',
      perigo: true,
    }))) return
    setModo(m)
    recomecar(periodo)
  }

  // Os votos viram os pedidos, e os dias do mês passam a ser os da votação — fixos: os jogadores
  // votaram nesses dias, então mudar dia é na própria votação, onde eles ficam sabendo.
  const importar = (r: ResultadoImportacao) => {
    const doVoto = aplicarVotos(r.votos, base.jogadores).pedidos
    setDatas([...r.votacao.datas].sort())
    setPedidos(doVoto)
    setVotados(doVoto)
    setAjustando(false)
    setDesempate([])
    setImportacao({ ...r, em: new Date().toISOString() })
  }
  // Pendência resolvida (criar, vincular, reativar) é voto, não ajuste: entra nos dois.
  const somarDias = (id: string, dias: string[]) => (p: Record<string, string[]>) =>
    ({ ...p, ...Object.fromEntries(dias.map((d) => [d, [...new Set([...(p[d] ?? []), id])]])) })
  const adicionarPedidos = (id: string, dias: string[]) => {
    setPedidos(somarDias(id, dias))
    setVotados(somarDias(id, dias))
  }

  // No modo votação a tabela só muda com "Ajustar à mão", e cada célula diferente do voto fica marcada.
  const porVotacao = importacao !== null
  const editavel = !porVotacao || ajustando
  const votou = (data: string, id: string) => votados[data]?.includes(id) ?? false
  const ajustes = porVotacao
    ? datas.reduce((n, d) => n + new Set([...(pedidos[d] ?? []), ...(votados[d] ?? [])]).size - (pedidos[d] ?? []).filter((id) => votou(d, id)).length, 0)
    : 0
  const voltarAosVotos = () => {
    setPedidos(votados)
    setAjustando(false)
  }

  const pediu = (data: string, id: string) => pedidos[data]?.includes(id) ?? false
  const alternar = (data: string, id: string) =>
    setPedidos((p) => ({ ...p, [data]: pediu(data, id) ? p[data].filter((x) => x !== id) : [...(p[data] ?? []), id] }))
  const alternarTodos = (id: string) => {
    const todos = datas.every((d) => pediu(d, id))
    setPedidos((p) => Object.fromEntries(datas.map((d) => [d, todos ? (p[d] ?? []).filter((x) => x !== id) : [...new Set([...(p[d] ?? []), id])]])))
  }

  // Ordem final: mais pontos primeiro; nos empates vale a ordem que o admin escolheu e,
  // se ele não mexeu, o desempate automático (menos desistências, mais avulsos, reserva mais antiga).
  const solicitantes = [...new Set(datas.flatMap((d) => pedidos[d] ?? []))]
  const posDesempate = (id: string) => { const i = desempate.indexOf(id); return i === -1 ? Infinity : i }
  const automatico = (a: string, b: string) => compararPrioridade(prioridade.get(a), prioridade.get(b)) || nome(a).localeCompare(nome(b))
  const ordem = solicitantes.sort(
    (a, b) => pontos(b) - pontos(a) || posDesempate(a) - posDesempate(b) || automatico(a, b),
  )
  const empates = gruposEmpate(ordem, pontos)
  const mover = (grupo: string[], id: string, delta: number) => {
    const g = [...grupo]
    const i = g.indexOf(id)
    const j = i + delta
    if (j < 0 || j >= g.length) return
    ;[g[i], g[j]] = [g[j], g[i]]
    setDesempate((d) => [...d.filter((x) => !g.includes(x)), ...g])
  }

  const sabadosTemp = datas.map((d) => ({ id: d, vagas }))
  const distribuicao = distribuirReservas(sabadosTemp, new Map(datas.map((d) => [d, new Set(pedidos[d] ?? [])])), ordem)

  const criar = async () => {
    if (jaExiste) return alert('Esse mês já existe.')
    if (datas.length === 0) return alert('Escolha pelo menos um dia.')
    setCriando(true)
    try {
      const { data: novoMes, error } = await supabase
        .from('meses')
        .insert({
          ano, mes,
          custo_campo_centavos: custoCentavos,
          pesos: base.config.pesos,
          avulso_multiplicador: base.config.avulso_multiplicador,
        })
        .select()
        .single()
      if (error) throw error
      const { data: sabs, error: e2 } = await supabase
        .from('sabados')
        .insert(datas.map((data) => ({ mes_id: novoMes.id, data, vagas })))
        .select()
      if (e2) throw e2
      const idPorData = new Map(sabs.map((s: { id: string; data: string }) => [s.data, s.id]))
      if (distribuicao.length) {
        await salvar(
          supabase.from('participacoes').insert(
            distribuicao.map((d) => ({ mes_id: novoMes.id, sabado_id: idPorData.get(d.sabado_id), jogador_id: d.jogador_id, tipo: d.tipo, ordem: d.ordem })),
          ),
        )
      } else await salvar()
      navegar(`/peladas/${novoMes.id}`)
    } catch (e) {
      alert('Erro ao criar o mês: ' + ((e as { message?: string }).message ?? String(e)))
    } finally {
      setCriando(false)
    }
  }

  // No modo votação, a montagem do mês só aparece depois de importar os votos.
  const montando = modo === 'manual' || importacao !== null
  const votosImportados = importacao?.votos.filter((v) => v.datas.length > 0).length ?? 0

  return (
    <div className="space-y-4">
      <CabecalhoPagina
        titulo="Novo mês"
        descricao="Monte as listas de reserva do mês a partir dos pedidos dos jogadores."
        acoes={periodos.lista.length > 0 && (
          <SeletorPeriodo className="w-full sm:w-auto" periodos={periodos.lista} valor={idPeriodo(periodo)} onChange={mudarMes} />
        )}
      />

      {sorteioConfigurado && (
        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="font-medium">Como chegam os pedidos?</p>
            <p className="text-xs text-muted-foreground">
              {modo === 'votacao'
                ? 'Os jogadores votam nos dias pelo app Sorteio e você importa os votos.'
                : 'Você marca na tabela os dias que cada jogador pediu.'}
            </p>
          </div>
          <Segmentado<Modo>
            rotulo="Origem dos pedidos"
            className="w-full sm:w-auto"
            valor={modo}
            onChange={trocarModo}
            opcoes={[
              { valor: 'votacao', rotulo: 'Votação no Sorteio', icone: Vote },
              { valor: 'manual', rotulo: 'Marcar à mão', icone: Hand },
            ]}
          />
        </Card>
      )}

      {modo === 'votacao' && <VotacaoSorteio ano={ano} mes={mes} diasSemana={diasPadrao} onImportar={importar} onExcluida={() => recomecar(periodo)} />}

      <Card className="p-0">
        <CardCabecalho
          icone={CalendarPlus}
          titulo={`Criar ${nomePeriodo(periodo).toLowerCase()}`}
          subtitulo={
            modo === 'manual'
              ? 'Escolha os dias e marque os pedidos de cada jogador.'
              : importacao
                ? `Pedidos importados da votação às ${new Date(importacao.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} (${votosImportados} ${votosImportados === 1 ? 'jogador' : 'jogadores'}). Para exceções, use "Ajustar à mão" nos pedidos.`
                : 'Importe os votos da votação acima para preencher os pedidos.'
          }
        />
        <div className="space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:max-w-md">
            <Campo rotulo="Custo do campo">
              <Input prefixo="R$" inputMode="decimal" value={custo} onChange={(e) => setCusto(e.target.value)} />
            </Campo>
            <Campo rotulo="Vagas por dia">
              <Input type="number" min={1} value={vagas} onChange={(e) => setVagas(Number(e.target.value))} />
            </Campo>
          </div>

          {montando && (
            <div>
              <p className="mb-1.5 text-xs text-muted-foreground">Dias de jogo</p>
              {porVotacao ? (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {datas.map((d) => (
                      <span key={d} className="inline-flex h-8 items-center rounded-lg border border-border bg-secondary/60 px-2.5 text-xs font-semibold">
                        {rotuloDia(d)}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Os dias vêm da votação. Para mudar, edite ou reabra a votação acima — assim os jogadores ficam sabendo e votam de novo.
                  </p>
                </>
              ) : (
                <SeletorDias ano={ano} mes={mes} diasSemana={diasPadrao} valor={datas} onChange={setDatas} />
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Até {vagas * datas.length} reservas ({vagas} × {datas.length} {datas.length === 1 ? 'dia' : 'dias'}) · campo de {formatarReais(custoCentavos)}.
              </p>
            </div>
          )}
        </div>
      </Card>

      {importacao && (
        <PendenciasImportacao votos={importacao.votos} jogadores={base.jogadores} onAdicionarPedidos={adicionarPedidos} />
      )}

      {montando && (
        <>
          <Card className="p-0">
            <CardCabecalho
              icone={ClipboardList}
              titulo="Pedidos de reserva"
              subtitulo={
                !porVotacao
                  ? 'A prioridade considera as reservas até o fim do mês anterior.'
                  : ajustes > 0
                    ? `${ajustes} ${ajustes === 1 ? 'ajuste' : 'ajustes'} em relação à votação, destacados na tabela.`
                    : ajustando
                      ? 'Marque ou desmarque as exceções. O que mudar em relação à votação fica destacado.'
                      : 'Exatamente como na votação.'
              }
              acoes={porVotacao && (
                <>
                  {ajustes > 0 && <Botao pequeno variante="fantasma" icone={Undo2} onClick={voltarAosVotos}>Voltar aos votos</Botao>}
                  <Botao pequeno variante={ajustando ? 'primario' : 'contorno'} icone={ajustando ? Check : Pencil} onClick={() => setAjustando(!ajustando)}>
                    {ajustando ? 'Concluir ajustes' : 'Ajustar à mão'}
                  </Botao>
                </>
              )}
            />
            <div className="max-h-120 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left">Jogador</th>
                    <th className="px-2 py-2">Pts</th>
                    {datas.map((d) => (
                      <th key={d} className="px-2 py-2">
                        {rotuloDia(d)}
                        <div className={cn('text-xs', (pedidos[d]?.length ?? 0) > vagas ? 'text-c-amarelo' : 'text-muted-foreground')}>{pedidos[d]?.length ?? 0}/{vagas}</div>
                      </th>
                    ))}
                    <th className="px-2 py-2">Todos</th>
                  </tr>
                </thead>
                <tbody>
                  {[...ativos].sort((a, b) => automatico(a.id, b.id)).map((j) => (
                    <tr key={j.id} className="border-t border-border/60">
                      <td className="px-4 py-1">{j.nome}</td>
                      <td className="px-2 text-center text-muted-foreground">{pontos(j.id)}</td>
                      {datas.map((d) => {
                        const ajustado = porVotacao && pediu(d, j.id) !== votou(d, j.id)
                        return (
                          <td
                            key={d}
                            className={cn('px-2 text-center', ajustado && 'bg-c-amarelo/15')}
                            title={ajustado ? (pediu(d, j.id) ? 'Adicionado à mão (não votou neste dia)' : 'Retirado à mão (votou neste dia)') : undefined}
                          >
                            <input type="checkbox" className="p-0" disabled={!editavel} checked={pediu(d, j.id)} onChange={() => alternar(d, j.id)} />
                          </td>
                        )
                      })}
                      <td className="px-2 text-center">
                        <input type="checkbox" className="p-0" disabled={!editavel} checked={datas.length > 0 && datas.every((d) => pediu(d, j.id))} onChange={() => alternarTodos(j.id)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {empates.length > 0 && (
            <Card className="p-0">
              <CardCabecalho
                icone={Scale}
                titulo="Empates na prioridade"
                subtitulo="Já vêm pelo desempate automático (menos desistências, mais avulsos, reserva mais antiga). Quem fica em cima tem preferência."
              />
              <div className="grid gap-3 p-4 sm:grid-cols-2">
                {empates.map((g) => (
                  <div key={g.join()} className="rounded-xl bg-secondary/60 p-3">
                    <Etiqueta cor="amarelo">{pontos(g[0])} pontos</Etiqueta>
                    <ol className="mt-2 space-y-1 text-sm">
                      {g.map((id, i) => (
                        <li key={id} className="flex items-center gap-2">
                          <span className="w-5 text-muted-foreground">{i + 1}.</span>
                          {nome(id)}
                          <span className="ml-auto flex gap-1">
                            <Botao pequeno variante="fantasma" disabled={i === 0} onClick={() => mover(g, id, -1)}>↑</Botao>
                            <Botao pequeno variante="fantasma" disabled={i === g.length - 1} onClick={() => mover(g, id, 1)}>↓</Botao>
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-0">
            <CardCabecalho icone={ListChecks} titulo="Resultado" subtitulo="Como as reservas ficam distribuídas com as vagas e a prioridade." />
            <div className="p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {datas.map((d) => {
                  const doDia = distribuicao.filter((x) => x.sabado_id === d)
                  const espera = doDia.filter((x) => x.tipo === 'espera')
                  const reservas = doDia.filter((x) => x.tipo === 'reserva')
                  return (
                    <div key={d} className="rounded-xl bg-secondary/60 p-3 text-sm">
                      <div className="font-semibold">{nomeDia(d)} <Etiqueta cor={reservas.length < vagas ? 'amarelo' : 'verde'}>{reservas.length}/{vagas}</Etiqueta></div>
                      {espera.length > 0 && (
                        <div className="mt-1 text-xs text-c-amarelo">Espera: {espera.map((x) => nome(x.jogador_id)).join(', ')}</div>
                      )}
                    </div>
                  )
                })}
              </div>
              <Botao variante="primario" className="mt-4" carregando={criando} disabled={jaExiste || datas.length === 0} onClick={criar}>
                Criar {nomePeriodo(periodo).toLowerCase()}
              </Botao>
              <p className="mt-2 text-xs text-muted-foreground">Depois de criado, ajustes nas listas são feitos na página Peladas (botão Editar de cada dia).</p>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
