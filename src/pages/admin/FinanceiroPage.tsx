import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useBase, usePagamentos, useSalvar } from '../../lib/api'
import { calcularRateio, formatarData, formatarReais } from '../../lib/calc'
import { supabase } from '../../lib/supabase'
import { Lock } from 'lucide-react'
import { Botao, CabecalhoPagina, Card, Carregando, Etiqueta, nomePeriodo, Rotulo, SeletorPeriodo } from '../../components/ui'

const reaisParaCentavos = (s: string) => Math.round(Number(s.replace(',', '.')) * 100) || 0
const centavosParaInput = (c: number) => (c / 100).toFixed(2).replace('.', ',')

export default function FinanceiroPage() {
  const { data, error } = useBase()
  const pag = usePagamentos(true)
  const salvar = useSalvar()
  const { mesId } = useParams()
  const navegar = useNavigate()

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
  if (data.meses.length === 0) return <p className="text-neutral-400">Nenhum mês cadastrado.</p>

  const mes = data.meses.find((m) => m.id === mesId) ?? data.meses[data.meses.length - 1]
  const parts = data.participacoes.filter((p) => p.mes_id === mes.id)
  const rateio = calcularRateio(mes, parts)
  const nome = (id: string) => data.jogadores.find((j) => j.id === id)?.nome ?? '?'
  const dataSabado = (id: string | null) => (id ? formatarData(data.sabados.find((s) => s.id === id)!.data) : '—')

  const pagRateio = new Map(pag.data.rateio.filter((p) => p.mes_id === mes.id).map((p) => [p.jogador_id, p]))
  const pagAvulso = new Map(pag.data.avulso.map((p) => [p.participacao_id, p]))
  const avulsos = parts.filter((p) => p.tipo === 'avulso')
  const valorAvulso = rateio.valor_avulso_centavos ?? 0

  const linhas = rateio.linhas
    .map((l) => {
      const p = pagRateio.get(l.jogador_id)
      const ajuste = p?.ajuste_centavos ?? 0
      return { ...l, nome: nome(l.jogador_id), pago: p?.pago ?? false, ajuste, total: l.valor_centavos + ajuste, obs: p?.observacao ?? '' }
    })
    .sort((a, b) => b.dias - a.dias || a.nome.localeCompare(b.nome))

  const recebidoRateio = linhas.filter((l) => l.pago).reduce((s, l) => s + l.total, 0)
  const totalRateio = linhas.reduce((s, l) => s + l.total, 0)
  const avulsosPagos = avulsos.filter((a) => pagAvulso.get(a.id)?.pago).length

  const salvarRateio = (jogador_id: string, campos: Record<string, unknown>) =>
    salvar(supabase.from('pagamentos_rateio').upsert({ mes_id: mes.id, jogador_id, ...pagRateio.get(jogador_id), ...campos }))
  const alternarAvulso = (participacao_id: string, pago: boolean) =>
    salvar(supabase.from('pagamentos_avulso').upsert({ participacao_id, pago, pago_em: pago ? new Date().toISOString() : null }))
  const atualizarMes = (campos: Record<string, unknown>) => salvar(supabase.from('meses').update(campos).eq('id', mes.id))

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
        acoes={<SeletorPeriodo className="w-full sm:w-auto" periodos={data.meses} valor={mes.id} onChange={(id) => navegar(`/admin/financeiro/${id}`)} />}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Resumo titulo="Valor a ratear" valor={formatarReais(rateio.valor_liquido_centavos)} detalhe={mes.abatimento_caixa_centavos ? `campo ${formatarReais(mes.custo_campo_centavos)} − caixa ${formatarReais(mes.abatimento_caixa_centavos)}` : 'custo do campo'} />
        <Resumo titulo="Valor do ponto" valor={rateio.valor_ponto ? formatarReais(Math.round(rateio.valor_ponto)) : '—'} detalhe={`${String(rateio.total_pontos).replace('.', ',')} pontos na turma`} />
        <Resumo titulo="Avulso por pelada" valor={rateio.valor_avulso_centavos ? formatarReais(valorAvulso) : '—'} detalhe={`ponto × ${String(mes.avulso_multiplicador).replace('.', ',')}`} />
        <Resumo titulo="Caixa extra (saldo)" valor={formatarReais(caixa.saldo)} detalhe={`entrou ${formatarReais(caixa.entradas)} · usado ${formatarReais(caixa.saidas)}`} />
      </div>

      {mes.observacao && <Card className="border-amber-700/50 text-sm text-amber-200">{mes.observacao}</Card>}

      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800 px-4 py-3">
          <h2 className="font-semibold">Rateio das reservas</h2>
          <span className="text-sm text-neutral-400">recebido {formatarReais(recebidoRateio)} de {formatarReais(totalRateio)}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-neutral-400">
              <tr>
                <th className="px-4 py-2">Jogador</th>
                <th className="px-2 py-2 text-center">Dias</th>
                <th className="px-2 py-2 text-center">Peso</th>
                <th className="px-2 py-2 text-right">Por pelada</th>
                <th className="px-2 py-2 text-right">Valor</th>
                <th className="px-2 py-2 text-right">Ajuste</th>
                <th className="px-2 py-2 text-right">Total</th>
                <th className="px-4 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.jogador_id} className="border-t border-neutral-800/60">
                  <td className="px-4 py-1.5 font-medium">{l.nome}</td>
                  <td className="px-2 text-center">{l.dias}</td>
                  <td className="px-2 text-center">{l.peso.toFixed(2).replace('.', ',')}</td>
                  <td className="px-2 text-right text-neutral-400">{formatarReais(l.valor_pelada_centavos)}</td>
                  <td className="px-2 text-right">{formatarReais(l.valor_centavos)}</td>
                  <td className="px-2 text-right">
                    <input
                      key={l.ajuste}
                      defaultValue={l.ajuste ? centavosParaInput(l.ajuste) : ''}
                      placeholder="0,00"
                      title={l.obs || 'Desconto (negativo) ou acréscimo (positivo)'}
                      className="w-20 py-1 text-right"
                      onBlur={(e) => {
                        const v = reaisParaCentavos(e.target.value)
                        if (v === l.ajuste) return
                        const observacao = v ? prompt('Motivo do ajuste:', l.obs) : null
                        salvarRateio(l.jogador_id, { ajuste_centavos: v, observacao })
                      }}
                    />
                  </td>
                  <td className="px-2 text-right font-semibold">{formatarReais(l.total)}</td>
                  <td className="px-4 text-center">
                    <StatusPago pago={l.pago} onClick={() => salvarRateio(l.jogador_id, { pago: !l.pago, pago_em: l.pago ? null : new Date().toISOString() })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800 px-4 py-3">
          <h2 className="font-semibold">Avulsos</h2>
          <span className="text-sm text-neutral-400">
            {avulsosPagos}/{avulsos.length} pagos · {formatarReais(avulsosPagos * valorAvulso)} para o caixa
          </span>
        </div>
        {avulsos.length === 0 ? (
          <p className="px-4 py-4 text-sm text-neutral-500">Nenhum avulso neste mês. Adicione avulsos na página <Link className="underline" to={`/peladas/${mes.id}`}>Peladas</Link>.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {[...avulsos]
                .sort((a, b) => dataSabado(a.sabado_id).localeCompare(dataSabado(b.sabado_id)) || nome(a.jogador_id).localeCompare(nome(b.jogador_id)))
                .map((a) => {
                  const pago = pagAvulso.get(a.id)?.pago ?? false
                  return (
                    <tr key={a.id} className="border-t border-neutral-800/60 first:border-0">
                      <td className="px-4 py-1.5 font-medium">{nome(a.jogador_id)}</td>
                      <td className="px-2 text-neutral-400">{a.sabado_id ? `Sábado ${dataSabado(a.sabado_id)}` : 'dia não registrado'}</td>
                      <td className="px-2 text-right">{formatarReais(valorAvulso)}</td>
                      <td className="px-4 text-center"><StatusPago pago={pago} onClick={() => alternarAvulso(a.id, !pago)} /></td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Dados do mês</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Rotulo texto="Custo do campo (R$)">
            <input key={mes.custo_campo_centavos} defaultValue={centavosParaInput(mes.custo_campo_centavos)} onBlur={(e) => {
              const v = reaisParaCentavos(e.target.value)
              if (v !== mes.custo_campo_centavos) atualizarMes({ custo_campo_centavos: v })
            }} />
          </Rotulo>
          <Rotulo texto={`Abater do caixa extra (R$) · saldo ${formatarReais(caixa.saldo)}`}>
            <input key={mes.abatimento_caixa_centavos} defaultValue={centavosParaInput(mes.abatimento_caixa_centavos)} onBlur={(e) => {
              const v = reaisParaCentavos(e.target.value)
              if (v === mes.abatimento_caixa_centavos) return
              if (v - mes.abatimento_caixa_centavos > caixa.saldo && !confirm('O valor é maior que o saldo do caixa. Continuar?')) return
              atualizarMes({ abatimento_caixa_centavos: v })
            }} />
          </Rotulo>
          <Rotulo texto="Situação">
            <Botao onClick={() => atualizarMes({ encerrado: !mes.encerrado })}>
              {mes.encerrado ? 'Reabrir mês' : 'Encerrar mês'}
            </Botao>
          </Rotulo>
        </div>
        <Rotulo texto="Observação">
          <textarea key={mes.observacao} className="mt-1" rows={2} defaultValue={mes.observacao ?? ''} onBlur={(e) => {
            if (e.target.value !== (mes.observacao ?? '')) atualizarMes({ observacao: e.target.value || null })
          }} />
        </Rotulo>
      </Card>
    </div>
  )
}

function Resumo({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe: string }) {
  return (
    <Card>
      <div className="text-xs uppercase tracking-wide text-neutral-400">{titulo}</div>
      <div className="mt-1 text-xl font-bold">{valor}</div>
      <div className="text-xs text-neutral-500">{detalhe}</div>
    </Card>
  )
}

function StatusPago({ pago, onClick }: { pago: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`rounded-md px-2 py-0.5 text-xs font-semibold ${pago ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
      {pago ? 'Pago' : 'Pendente'}
    </button>
  )
}
