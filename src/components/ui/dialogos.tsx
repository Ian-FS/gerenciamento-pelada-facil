import { createContext, useContext, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Botao } from './botao'
import { Campo, Input, Textarea } from './campos'
import { Modal } from './modal'

export interface OpcoesConfirmar {
  titulo: string
  descricao?: ReactNode
  /** Texto do botão de confirmação. */
  confirmar?: string
  cancelar?: string
  perigo?: boolean
}

export interface CampoPergunta {
  nome: string
  rotulo: string
  tipo?: 'texto' | 'numero' | 'dinheiro' | 'longo'
  valor?: string
  placeholder?: string
  dica?: string
  obrigatorio?: boolean
}

export interface OpcoesPerguntar {
  titulo: string
  descricao?: ReactNode
  campos: CampoPergunta[]
  confirmar?: string
  perigo?: boolean
}

interface Dialogos {
  /** Substitui window.confirm. Resolve true se confirmado. */
  confirmar: (o: OpcoesConfirmar) => Promise<boolean>
  /** Substitui window.prompt. Resolve com os valores por nome, ou null se cancelado. */
  perguntar: (o: OpcoesPerguntar) => Promise<Record<string, string> | null>
}

const Ctx = createContext<Dialogos | null>(null)

type Estado =
  | { tipo: 'confirmar'; opcoes: OpcoesConfirmar; resolver: (v: boolean) => void }
  | { tipo: 'perguntar'; opcoes: OpcoesPerguntar; resolver: (v: Record<string, string> | null) => void }

export function DialogosProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado | null>(null)
  const atual = useRef<Estado | null>(null)

  const abrir = (e: Estado) => {
    // Se já havia um diálogo aberto, cancela o anterior.
    const anterior = atual.current
    if (anterior) anterior.tipo === 'confirmar' ? anterior.resolver(false) : anterior.resolver(null)
    atual.current = e
    setEstado(e)
  }
  const fechar = () => {
    atual.current = null
    setEstado(null)
  }

  // abrir só usa setState e ref, então a API pode ser criada uma vez.
  const api = useMemo<Dialogos>(() => ({
    confirmar: (opcoes) => new Promise((resolver) => abrir({ tipo: 'confirmar', opcoes, resolver })),
    perguntar: (opcoes) => new Promise((resolver) => abrir({ tipo: 'perguntar', opcoes, resolver })),
  }), [])

  return (
    <Ctx.Provider value={api}>
      {children}
      {estado?.tipo === 'confirmar' && (
        <Modal
          aberto
          focoInicial
          titulo={estado.opcoes.titulo}
          descricao={estado.opcoes.descricao}
          onFechar={() => { estado.resolver(false); fechar() }}
          rodape={
            <>
              <Botao variante="fantasma" onClick={() => { estado.resolver(false); fechar() }}>
                {estado.opcoes.cancelar ?? 'Cancelar'}
              </Botao>
              <Botao variante={estado.opcoes.perigo ? 'perigo' : 'primario'} onClick={() => { estado.resolver(true); fechar() }}>
                {estado.opcoes.confirmar ?? 'Confirmar'}
              </Botao>
            </>
          }
        />
      )}
      {estado?.tipo === 'perguntar' && (
        <FormPergunta
          opcoes={estado.opcoes}
          onFim={(v) => { estado.resolver(v); fechar() }}
        />
      )}
    </Ctx.Provider>
  )
}

function FormPergunta({ opcoes, onFim }: { opcoes: OpcoesPerguntar; onFim: (v: Record<string, string> | null) => void }) {
  const [valores, setValores] = useState(() => Object.fromEntries(opcoes.campos.map((c) => [c.nome, c.valor ?? ''])))
  const formId = useId()
  const enviar = (e: FormEvent) => {
    e.preventDefault()
    onFim(Object.fromEntries(Object.entries(valores).map(([k, v]) => [k, v.trim()])))
  }
  return (
    <Modal
      aberto
      titulo={opcoes.titulo}
      descricao={opcoes.descricao}
      onFechar={() => onFim(null)}
      rodape={
        <>
          <Botao variante="fantasma" onClick={() => onFim(null)}>Cancelar</Botao>
          <Botao type="submit" form={formId} variante={opcoes.perigo ? 'perigo' : 'primario'}>
            {opcoes.confirmar ?? 'Salvar'}
          </Botao>
        </>
      }
    >
      <form id={formId} onSubmit={enviar} className="flex flex-col gap-4">
        {opcoes.campos.map((c) => {
          const comum = {
            value: valores[c.nome],
            placeholder: c.placeholder,
            required: c.obrigatorio,
            onChange: (e: { target: { value: string } }) => setValores((v) => ({ ...v, [c.nome]: e.target.value })),
          }
          return (
            <Campo key={c.nome} rotulo={c.rotulo} dica={c.dica}>
              {c.tipo === 'longo' ? (
                <Textarea rows={3} {...comum} />
              ) : c.tipo === 'numero' ? (
                <Input type="text" inputMode="numeric" pattern="-?[0-9]*" {...comum} />
              ) : c.tipo === 'dinheiro' ? (
                <Input type="text" inputMode="decimal" prefixo="R$" {...comum} />
              ) : (
                <Input type="text" {...comum} />
              )}
            </Campo>
          )
        })}
      </form>
    </Modal>
  )
}

export function useDialogos() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useDialogos precisa do DialogosProvider')
  return ctx
}
