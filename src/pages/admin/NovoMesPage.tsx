import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBase, useSalvar, type Base } from '../../lib/api'
import { calcularPrioridade, distribuirReservas, formatarData, formatarReais, gruposEmpate, inicioDoMes, NOMES_MESES } from '../../lib/calc'
import { supabase } from '../../lib/supabase'
import { Botao, Card, Carregando, Etiqueta, Rotulo, Titulo } from '../../components/ui'

function sabadosDoMes(ano: number, mes: number): string[] {
  const out: string[] = []
  for (let d = 1; d <= 31; d++) {
    const dt = new Date(ano, mes - 1, d)
    if (dt.getMonth() !== mes - 1) break
    if (dt.getDay() === 6) out.push(`${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  return out
}

export default function NovoMesPage() {
  const { data, error } = useBase()
  if (!data) return <Carregando erro={error} />
  return <Formulario base={data} />
}

function Formulario({ base }: { base: Base }) {
  const salvar = useSalvar()
  const navegar = useNavigate()
  const ultimo = base.meses[base.meses.length - 1]
  const hoje = new Date()
  const [ano, setAno] = useState(ultimo ? (ultimo.mes === 12 ? ultimo.ano + 1 : ultimo.ano) : hoje.getFullYear())
  const [mes, setMes] = useState(ultimo ? (ultimo.mes % 12) + 1 : hoje.getMonth() + 1)
  const [custo, setCusto] = useState(String(base.config.custo_campo_padrao_centavos / 100))
  const [vagas, setVagas] = useState(base.config.vagas_padrao)
  const [datas, setDatas] = useState(() => sabadosDoMes(ano, mes))
  const [pedidos, setPedidos] = useState<Record<string, string[]>>({}) // data -> jogadores
  const [desempate, setDesempate] = useState<string[]>([]) // ordem escolhida pelo admin para empates
  const [criando, setCriando] = useState(false)

  const jaExiste = base.meses.some((m) => m.ano === ano && m.mes === mes)
  const ativos = base.jogadores.filter((j) => j.ativo)
  const nome = (id: string) => base.jogadores.find((j) => j.id === id)?.nome ?? '?'

  const prioridade = useMemo(
    () => calcularPrioridade(base.participacoes, base.sabados, base.ajustes, inicioDoMes(ano, mes)),
    [base, ano, mes],
  )
  const pontos = (id: string) => prioridade.get(id)?.pontos ?? 0

  const mudarMes = (a: number, m: number) => {
    setAno(a)
    setMes(m)
    setDatas(sabadosDoMes(a, m))
    setPedidos({})
  }

  const pediu = (data: string, id: string) => pedidos[data]?.includes(id) ?? false
  const alternar = (data: string, id: string) =>
    setPedidos((p) => ({ ...p, [data]: pediu(data, id) ? p[data].filter((x) => x !== id) : [...(p[data] ?? []), id] }))
  const alternarTodos = (id: string) => {
    const todos = datas.every((d) => pediu(d, id))
    setPedidos((p) => Object.fromEntries(datas.map((d) => [d, todos ? (p[d] ?? []).filter((x) => x !== id) : [...new Set([...(p[d] ?? []), id])]])))
  }

  // Ordem final: mais pontos primeiro; empates pela ordem escolhida pelo admin (ou nome)
  const solicitantes = [...new Set(datas.flatMap((d) => pedidos[d] ?? []))]
  const posDesempate = (id: string) => { const i = desempate.indexOf(id); return i === -1 ? Infinity : i }
  const ordem = solicitantes.sort(
    (a, b) => pontos(b) - pontos(a) || posDesempate(a) - posDesempate(b) || nome(a).localeCompare(nome(b)),
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
    if (datas.length === 0) return alert('Escolha pelo menos um sábado.')
    setCriando(true)
    try {
      const { data: novoMes, error } = await supabase
        .from('meses')
        .insert({
          ano, mes,
          custo_campo_centavos: Math.round(Number(custo.replace(',', '.')) * 100),
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

  return (
    <div className="space-y-4">
      <Titulo>Novo mês</Titulo>

      <Card>
        <h2 className="mb-3 font-semibold">1. Mês e sábados</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <Rotulo texto="Mês">
            <select value={mes} onChange={(e) => mudarMes(ano, Number(e.target.value))}>
              {NOMES_MESES.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
            </select>
          </Rotulo>
          <Rotulo texto="Ano">
            <input type="number" value={ano} onChange={(e) => mudarMes(Number(e.target.value), mes)} />
          </Rotulo>
          <Rotulo texto="Custo do campo (R$)">
            <input value={custo} onChange={(e) => setCusto(e.target.value)} />
          </Rotulo>
          <Rotulo texto="Vagas por sábado">
            <input type="number" min={1} value={vagas} onChange={(e) => setVagas(Number(e.target.value))} />
          </Rotulo>
        </div>
        {jaExiste && <p className="mt-2 text-sm text-red-400">{NOMES_MESES[mes - 1]}/{ano} já está cadastrado.</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {sabadosDoMes(ano, mes).map((d) => (
            <label key={d} className="flex items-center gap-1.5 rounded-lg bg-neutral-800 px-2 py-1 text-sm">
              <input type="checkbox" className="p-0" checked={datas.includes(d)} onChange={() => setDatas((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d].sort()))} />
              Sábado {formatarData(d)}
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Máximo de reservas no mês: {vagas * datas.length} ({vagas} × {datas.length} sábados). Valor do campo: {formatarReais(Math.round(Number(custo.replace(',', '.')) * 100) || 0)}.
        </p>
      </Card>

      <Card className="p-0">
        <div className="border-b border-neutral-800 px-4 py-3">
          <h2 className="font-semibold">2. Pedidos de reserva</h2>
          <p className="text-xs text-neutral-400">Marque os sábados que cada jogador pediu. A prioridade considera as reservas até o fim do mês anterior.</p>
        </div>
        <div className="max-h-[480px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-neutral-900 text-neutral-400">
              <tr>
                <th className="px-4 py-2 text-left">Jogador</th>
                <th className="px-2 py-2">Pts</th>
                {datas.map((d) => (
                  <th key={d} className="px-2 py-2">
                    {formatarData(d)}
                    <div className={`text-xs ${(pedidos[d]?.length ?? 0) > vagas ? 'text-amber-400' : 'text-neutral-500'}`}>{pedidos[d]?.length ?? 0}/{vagas}</div>
                  </th>
                ))}
                <th className="px-2 py-2">Todos</th>
              </tr>
            </thead>
            <tbody>
              {[...ativos].sort((a, b) => pontos(b.id) - pontos(a.id) || a.nome.localeCompare(b.nome)).map((j) => (
                <tr key={j.id} className="border-t border-neutral-800/60">
                  <td className="px-4 py-1">{j.nome}</td>
                  <td className="px-2 text-center text-neutral-400">{pontos(j.id)}</td>
                  {datas.map((d) => (
                    <td key={d} className="px-2 text-center">
                      <input type="checkbox" className="p-0" checked={pediu(d, j.id)} onChange={() => alternar(d, j.id)} />
                    </td>
                  ))}
                  <td className="px-2 text-center">
                    <input type="checkbox" className="p-0" checked={datas.length > 0 && datas.every((d) => pediu(d, j.id))} onChange={() => alternarTodos(j.id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {empates.length > 0 && (
        <Card>
          <h2 className="mb-1 font-semibold">3. Empates na prioridade</h2>
          <p className="mb-3 text-xs text-neutral-400">Defina a ordem entre os empatados (quem fica em cima tem preferência).</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {empates.map((g) => (
              <div key={g.join()} className="rounded-xl bg-neutral-800/60 p-3">
                <Etiqueta cor="amarelo">{pontos(g[0])} pontos</Etiqueta>
                <ol className="mt-2 space-y-1 text-sm">
                  {g.map((id, i) => (
                    <li key={id} className="flex items-center gap-2">
                      <span className="w-5 text-neutral-500">{i + 1}.</span>
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

      <Card>
        <h2 className="mb-3 font-semibold">{empates.length ? '4' : '3'}. Resultado</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {datas.map((d) => {
            const doDia = distribuicao.filter((x) => x.sabado_id === d)
            const espera = doDia.filter((x) => x.tipo === 'espera')
            const reservas = doDia.filter((x) => x.tipo === 'reserva')
            return (
              <div key={d} className="rounded-xl bg-neutral-800/60 p-3 text-sm">
                <div className="font-semibold">Sábado {formatarData(d)} <Etiqueta cor={reservas.length < vagas ? 'amarelo' : 'verde'}>{reservas.length}/{vagas}</Etiqueta></div>
                {espera.length > 0 && (
                  <div className="mt-1 text-xs text-amber-300">Espera: {espera.map((x) => nome(x.jogador_id)).join(', ')}</div>
                )}
              </div>
            )
          })}
        </div>
        <Botao variante="primario" className="mt-4" disabled={criando || jaExiste} onClick={criar}>
          {criando ? 'Criando…' : `Criar ${NOMES_MESES[mes - 1]}/${ano}`}
        </Botao>
        <p className="mt-2 text-xs text-neutral-500">Depois de criado, ajustes nas listas são feitos na página Peladas (botão Editar de cada sábado).</p>
      </Card>
    </div>
  )
}
