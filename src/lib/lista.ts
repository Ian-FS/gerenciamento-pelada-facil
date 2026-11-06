import { DIAS_SEMANA, diaDaSemana, formatarData, formatarReais, NOMES_MESES } from './calc'

/** Variáveis aceitas no template da lista (Configurações → Mensagem da lista). */
export const VARIAVEIS_LISTA: { chave: string; descricao: string }[] = [
  { chave: '{DIA_SEMANA}', descricao: 'dia da semana em maiúsculas (SÁBADO)' },
  { chave: '{dia_semana}', descricao: 'dia da semana (sábado)' },
  { chave: '{data}', descricao: 'data do jogo (07/11)' },
  { chave: '{mes}', descricao: 'nome do mês (novembro)' },
  { chave: '{valor_avulso}', descricao: 'valor do avulso no mês (R$ 16,14)' },
  { chave: '{vagas}', descricao: 'número de vagas do dia' },
  { chave: '{lista}', descricao: 'reservas e avulsos numerados, com as vagas abertas em branco' },
  { chave: '{espera}', descricao: 'lista de espera numerada (sempre com linhas em branco no fim)' },
]

export const TEMPLATE_LISTA_PADRAO = `🗒️ @todos LISTA DE PRESENÇA DE {DIA_SEMANA} {data}

🏟️ Local: Cartola FC
⏰ Horario: 8:00h

🔑 PIX: (chave) (nome)
💰*Valor do Avulso: {valor_avulso}*

💡Favor lançar o comprovante do Pix nesse canal.

🚨Pedimos que os membros do grupo *não assinem* a lista por outros membros do grupo 🚨

📢 Fiquem à vontade para adicionar possíveis jogadores *externos* na lista de espera 🫶 (vale a regra pra membros externos)

{lista}

Lista de Espera:
{espera}`

/** Linhas numeradas "1 - Nome"; completa com números em branco até `minimo` linhas. */
const numerar = (nomes: string[], minimo: number) =>
  Array.from({ length: Math.max(nomes.length, minimo) }, (_, i) => (nomes[i] ? `${i + 1} - ${nomes[i]}` : `${i + 1}`)).join('\n')

/**
 * Monta a mensagem da lista de um dia a partir do template.
 * `confirmados` já vem na ordem da lista (reservas e depois avulsos, sem quem desistiu).
 */
export function montarLista(
  template: string,
  dia: { data: string; vagas: number; confirmados: string[]; espera: string[]; valorAvulsoCentavos: number | null },
): string {
  const [, m] = dia.data.split('-').map(Number)
  const nomeDia = DIAS_SEMANA[diaDaSemana(dia.data)]
  const valores: Record<string, string> = {
    '{DIA_SEMANA}': nomeDia.toUpperCase(),
    '{dia_semana}': nomeDia,
    '{data}': formatarData(dia.data),
    '{mes}': NOMES_MESES[m - 1].toLowerCase(),
    '{valor_avulso}': dia.valorAvulsoCentavos == null ? '—' : formatarReais(dia.valorAvulsoCentavos),
    '{vagas}': String(dia.vagas),
    '{lista}': numerar(dia.confirmados, dia.vagas),
    '{espera}': numerar(dia.espera, Math.max(2, dia.espera.length + 1)),
  }
  return template.replace(/\{(DIA_SEMANA|dia_semana|data|mes|valor_avulso|vagas|lista|espera)\}/g, (v) => valores[v])
}
