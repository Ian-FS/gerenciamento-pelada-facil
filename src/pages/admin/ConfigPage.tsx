import { useState } from 'react'
import { useBase, useSalvar, type Base } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import { Botao, Card, Carregando, Rotulo, Titulo } from '../../components/ui'

export default function ConfigPage() {
  const { data, error } = useBase()
  if (!data) return <Carregando erro={error} />
  return <Formulario key={JSON.stringify(data.config)} config={data.config} />
}

function Formulario({ config }: { config: Base['config'] }) {
  const salvar = useSalvar()
  const [vagas, setVagas] = useState(config.vagas_padrao)
  const [custo, setCusto] = useState(String(config.custo_campo_padrao_centavos / 100))
  const [mult, setMult] = useState(String(config.avulso_multiplicador))
  const [pesos, setPesos] = useState(
    Object.entries(config.pesos).map(([dias, peso]) => ({ dias: Number(dias), peso: String(peso) })).sort((a, b) => a.dias - b.dias),
  )

  const gravar = () =>
    salvar(
      supabase
        .from('configuracoes')
        .update({
          vagas_padrao: vagas,
          custo_campo_padrao_centavos: Math.round(Number(custo.replace(',', '.')) * 100),
          avulso_multiplicador: Number(mult.replace(',', '.')),
          pesos: Object.fromEntries(pesos.map((p) => [String(p.dias), Number(p.peso.replace(',', '.'))])),
        })
        .eq('id', 1),
    ).then(() => alert('Configurações salvas.'))

  return (
    <div className="space-y-4">
      <Titulo>Configurações</Titulo>
      <p className="text-sm text-neutral-400">
        Estes valores são usados ao criar um <b>novo mês</b>. Meses já criados guardam a configuração da época (o custo e as
        vagas de cada mês/sábado podem ser alterados no Financeiro e na página Peladas).
      </p>
      <Card className="grid gap-3 sm:grid-cols-3">
        <Rotulo texto="Vagas por sábado">
          <input type="number" min={1} value={vagas} onChange={(e) => setVagas(Number(e.target.value))} />
        </Rotulo>
        <Rotulo texto="Custo padrão do campo (R$)">
          <input value={custo} onChange={(e) => setCusto(e.target.value)} />
        </Rotulo>
        <Rotulo texto="Multiplicador do avulso (× valor do ponto)">
          <input value={mult} onChange={(e) => setMult(e.target.value)} />
        </Rotulo>
      </Card>
      <Card>
        <h2 className="mb-1 font-semibold">Peso por dias reservados</h2>
        <p className="mb-3 text-xs text-neutral-400">Quem reserva mais dias tem peso menor (paga menos por pelada). Acima da maior faixa, vale o peso da maior faixa.</p>
        <div className="space-y-2">
          {pesos.map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <input type="number" min={1} className="w-20" value={p.dias} onChange={(e) => setPesos(pesos.map((x, k) => (k === i ? { ...x, dias: Number(e.target.value) } : x)))} />
              <span className="text-neutral-400">dia(s) → peso</span>
              <input className="w-24" value={p.peso} onChange={(e) => setPesos(pesos.map((x, k) => (k === i ? { ...x, peso: e.target.value } : x)))} />
              <Botao pequeno variante="fantasma" onClick={() => setPesos(pesos.filter((_, k) => k !== i))}>✕</Botao>
            </div>
          ))}
        </div>
        <Botao pequeno className="mt-2" onClick={() => setPesos([...pesos, { dias: (pesos[pesos.length - 1]?.dias ?? 0) + 1, peso: '' }])}>
          + faixa
        </Botao>
      </Card>
      <Botao variante="primario" onClick={gravar}>Salvar configurações</Botao>
    </div>
  )
}
