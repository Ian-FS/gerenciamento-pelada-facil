import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck, Check, Download, Lock, Save, Trash2, Unlock } from 'lucide-react'
import { useSalvar } from '../lib/api'
import { diasDoMes, NOMES_MESES, rotuloDia } from '../lib/calc'
import { cn } from '../lib/cn'
import {
  abrirVotacao, aceitaVotos, aplicarVotos, encerrarVotacao, excluirVotacao, importarVotacao, lerVotacao,
  type VotacaoSorteio as Votacao, type VotoSorteio,
} from '../lib/sorteio'
import { supabase } from '../lib/supabase'
import { SeletorDias } from './SeletorDias'
import type { Jogador } from '../lib/types'
import { Botao, Card, CardCabecalho, Select, useDialogos, useToast } from './ui'

const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** ISO → valor de <input type="datetime-local"> no fuso do navegador. */
function paraInputLocal(iso: string) {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export type ResultadoImportacao = { votacao: Votacao; votos: VotoSorteio[] }

/**
 * A votação dos dias de jogo que os jogadores respondem no app Sorteio. Tem os próprios dias
 * (independentes dos do mês) e só a Gestão abre, edita, reabre e importa.
 */
export function VotacaoSorteio({ ano, mes, diasSemana, onImportar, onExcluida }: {
  ano: number
  mes: number
  /** dias da semana sugeridos ao abrir (Configurações) */
  diasSemana: number[]
  onImportar: (r: ResultadoImportacao) => void
  /** a votação foi apagada: o que foi importado dela deixa de valer */
  onExcluida: () => void
}) {
  const { data, error, isLoading } = useQuery({ queryKey: ['votacao-sorteio', ano, mes], queryFn: () => lerVotacao(ano, mes) })
  const v = data?.votacao

  return (
    <Card className="p-0">
      <CardCabecalho
        icone={CalendarCheck}
        titulo="Votação dos dias"
        subtitulo="Os jogadores marcam no app Sorteio os dias em que vão jogar."
        acoes={v && <Etapas votacao={v} />}
      />
      <div className="p-4">
        {isLoading && <p className="text-sm text-muted-foreground">Consultando a votação no Sorteio…</p>}
        {error && <p className="text-sm text-destructive">Não foi possível consultar o Sorteio: {(error as Error).message}</p>}
        {data !== undefined && (
          // Remonta quando a votação muda no servidor, para os campos recomeçarem dela.
          <Painel key={`${ano}-${mes}:${v?.status}:${v?.datas.join()}:${v?.prazo}`} ano={ano} mes={mes} diasSemana={diasSemana} votacao={v ?? null} votaram={data?.votaram ?? 0} onImportar={onImportar} onExcluida={onExcluida} />
        )}
      </div>
    </Card>
  )
}

/** Abrir → Votando → Importar, com a etapa atual em destaque. */
function Etapas({ votacao }: { votacao: Votacao }) {
  const atual = aceitaVotos(votacao) ? 1 : votacao.importadaEm ? 3 : 2
  return (
    <ol className="flex items-center gap-1 text-[11px] font-semibold">
      {['Aberta', 'Votando', 'Importar'].map((nome, i) => (
        <li key={nome} className="flex items-center gap-1">
          {i > 0 && <span className="text-muted-foreground">→</span>}
          <span className={cn('rounded-full px-2 py-0.5', i < atual ? 'bg-primary/15 text-primary' : i === atual ? 'bg-c-amarelo/15 text-c-amarelo' : 'bg-secondary text-muted-foreground')}>
            {i < atual && <Check size={10} className="mr-0.5 inline" />}
            {nome}
          </span>
        </li>
      ))}
    </ol>
  )
}

function Painel({ ano, mes, diasSemana, votacao: v, votaram, onImportar, onExcluida }: {
  ano: number
  mes: number
  diasSemana: number[]
  votacao: Votacao | null
  votaram: number
  onImportar: (r: ResultadoImportacao) => void
  onExcluida: () => void
}) {
  const qc = useQueryClient()
  const toast = useToast()
  const { confirmar } = useDialogos()
  const prazoAtual = v?.prazo && Date.parse(v.prazo) > Date.now() ? paraInputLocal(v.prazo) : ''
  const [datas, setDatas] = useState(() => v?.datas ?? diasDoMes(ano, mes, diasSemana))
  const [prazo, setPrazo] = useState(prazoAtual)
  const [ocupado, setOcupado] = useState(false)
  const nomeMes = NOMES_MESES[mes - 1]
  const aberta = v ? aceitaVotos(v) : false

  const executar = async (acao: () => Promise<unknown>, sucesso: string) => {
    setOcupado(true)
    try {
      await acao()
      toast.sucesso(sucesso)
    } catch (e) {
      toast.erro((e as Error).message)
    } finally {
      setOcupado(false)
      await qc.invalidateQueries({ queryKey: ['votacao-sorteio', ano, mes] })
    }
  }

  const prazoIso = prazo ? new Date(prazo).toISOString() : undefined
  const removidos = v ? v.datas.filter((d) => !datas.includes(d)) : []
  const mudou = v ? removidos.length > 0 || datas.some((d) => !v.datas.includes(d)) || prazo !== prazoAtual : false
  const avisoRemovidos = removidos.length
    ? `Os votos em ${removidos.map(rotuloDia).join(', ')} deixam de contar (o resto do voto de cada um continua valendo). `
    : ''

  const salvar = async (rotulo: string, sucesso: string, aviso = '') => {
    const texto = aviso + avisoRemovidos
    if (texto && !(await confirmar({ titulo: `${rotulo}?`, descricao: texto, confirmar: rotulo }))) return
    executar(() => abrirVotacao(ano, mes, datas, prazoIso), sucesso)
  }

  const reabrir = () =>
    salvar('Reabrir a votação', 'Votação reaberta', v?.importadaEm
      ? 'Estes votos já foram importados. Se o mês já foi criado, votos novos não chegam a ele sozinhos — exclua o mês no Financeiro e importe de novo. '
      : '')

  const importar = async () => {
    if (aberta && !(await confirmar({
      titulo: `Encerrar e importar os votos de ${nomeMes}?`,
      descricao: 'Ninguém consegue mais mudar o voto. Dá para reabrir depois, se precisar.',
      confirmar: 'Encerrar e importar',
    }))) return
    executar(async () => onImportar(await importarVotacao(ano, mes)), 'Votos importados')
  }

  const excluir = async () => {
    if (!v) return
    const partes = [
      `Apaga a votação de ${nomeMes.toLowerCase()} e ${votaram === 1 ? 'o voto registrado' : `os ${votaram} votos registrados`} no Sorteio. Não dá para desfazer.`,
      aberta ? 'Ela ainda está aberta: os jogadores deixam de ver a votação no app.' : '',
      v.importadaEm ? 'Um mês já criado a partir dela continua como está; se quiser refazer, exclua o mês no Financeiro.' : '',
      'Depois dá para abrir outra votação do zero.',
    ]
    if (!(await confirmar({ titulo: `Excluir a votação de ${nomeMes.toLowerCase()}?`, descricao: partes.filter(Boolean).join(' '), confirmar: 'Excluir votação', perigo: true }))) return
    executar(async () => {
      await excluirVotacao(ano, mes)
      onExcluida()
    }, 'Votação excluída')
  }

  return (
    <div className="space-y-4 text-sm">
      {v && (
        <p className="text-muted-foreground">
          {aberta ? <><b className="text-foreground">Aberta</b> · {votaram} já votaram</> : <><b className="text-foreground">Encerrada</b> · {votaram} votos</>}
          {aberta && v.prazo && ` · prazo ${quando(v.prazo)}`}
          {v.importadaEm && ` · importada em ${quando(v.importadaEm)}`}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div>
          <p className="mb-1.5 text-xs text-muted-foreground">Dias em votação</p>
          <SeletorDias ano={ano} mes={mes} diasSemana={diasSemana} valor={datas} onChange={setDatas} />
        </div>
        <label className="text-xs text-muted-foreground">
          Prazo (opcional)
          <input type="datetime-local" className="mt-1.5 block h-8" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {!v && (
          <Botao variante="primario" carregando={ocupado} disabled={datas.length === 0} onClick={() => salvar('Abrir a votação', 'Votação aberta no Sorteio')}>
            Abrir votação com {datas.length} {datas.length === 1 ? 'dia' : 'dias'}
          </Botao>
        )}
        {v && (
          <Botao variante="primario" icone={Download} carregando={ocupado} onClick={importar}>
            {aberta ? 'Encerrar e importar votos' : v.importadaEm ? 'Importar de novo' : 'Importar votos'}
          </Botao>
        )}
        {v && aberta && (
          <>
            <Botao variante="contorno" icone={Save} disabled={ocupado || !mudou || datas.length === 0} onClick={() => salvar('Atualizar a votação', 'Votação atualizada')}>
              Salvar alterações
            </Botao>
            <Botao variante="fantasma" icone={Lock} disabled={ocupado} onClick={() => executar(() => encerrarVotacao(ano, mes), 'Votação encerrada')}>
              Só encerrar
            </Botao>
          </>
        )}
        {v && !aberta && (
          <Botao variante="contorno" icone={Unlock} disabled={ocupado || datas.length === 0} onClick={reabrir}>
            Reabrir
          </Botao>
        )}
        {v && (
          <Botao variante="perigoSuave" icone={Trash2} disabled={ocupado} className="sm:ml-auto" onClick={excluir}>
            Excluir votação
          </Botao>
        )}
      </div>
    </div>
  )
}

/**
 * Votos que a importação não conseguiu transformar em pedido. Cada ação resolve o vínculo
 * (ou reativa) e já soma os dias daquele jogador aos pedidos.
 */
export function PendenciasImportacao({ votos, jogadores, onAdicionarPedidos }: {
  votos: VotoSorteio[]
  jogadores: Jogador[]
  onAdicionarPedidos: (jogadorId: string, datas: string[]) => void
}) {
  const salvar = useSalvar()
  const { semVinculo, inativos } = aplicarVotos(votos, jogadores)
  if (semVinculo.length === 0 && inativos.length === 0) return null
  const livres = jogadores.filter((j) => !j.sorteio_id)
  const dias = (datas: string[]) => datas.map(rotuloDia).join(', ')

  const criar = async (v: VotoSorteio) => {
    const id = crypto.randomUUID()
    await salvar(supabase.from('jogadores').insert({ id, nome: v.nome, sorteio_id: v.playerId }))
    onAdicionarPedidos(id, v.datas)
  }
  const vincular = async (v: VotoSorteio, jogadorId: string) => {
    await salvar(supabase.from('jogadores').update({ sorteio_id: v.playerId, ativo: true }).eq('id', jogadorId))
    onAdicionarPedidos(jogadorId, v.datas)
  }
  const reativar = async (j: Jogador, datas: string[]) => {
    await salvar(supabase.from('jogadores').update({ ativo: true }).eq('id', j.id))
    onAdicionarPedidos(j.id, datas)
  }

  return (
    <div className="space-y-2 rounded-xl border border-c-amarelo/40 bg-c-amarelo/5 p-3 text-sm">
      <p className="font-semibold text-c-amarelo">Votos que ainda não entraram nos pedidos</p>
      {semVinculo.map((v) => (
        <div key={v.playerId} className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 flex-1">
            <b>{v.nome ?? 'Jogador removido do Sorteio'}</b> votou em {dias(v.datas)}, mas não está vinculado.
          </span>
          {v.nome && <Botao pequeno onClick={() => criar(v)}>Criar na Gestão</Botao>}
          <Select className="w-44" value="" onChange={(e) => e.target.value && vincular(v, e.target.value)}>
            <option value="">Vincular a…</option>
            {livres.map((j) => <option key={j.id} value={j.id}>{j.nome}{j.ativo ? '' : ' (inativo)'}</option>)}
          </Select>
        </div>
      ))}
      {inativos.map(({ jogador, datas }) => (
        <div key={jogador.id} className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 flex-1"><b>{jogador.nome}</b> votou em {dias(datas)}, mas está inativo.</span>
          <Botao pequeno onClick={() => reativar(jogador, datas)}>Reativar</Botao>
        </div>
      ))}
    </div>
  )
}
