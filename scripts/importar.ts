/**
 * Importa o histórico da planilha (dados.md) e gera:
 *   - supabase/seed.sql               -> dados para rodar no Supabase depois do esquema
 *   - docs/relatorio-importacao.md    -> conferência: o que foi deduzido e o que não fechou
 *
 * Regras de dedução (combinadas com o admin):
 *   - Aba do mês = quem reservou antecipadamente e quantos dias (base do rateio e da prioridade).
 *   - Aba Datas = lista de cada sábado. Dentro das vagas (15) e sem reserva = avulso (pagou).
 *     Fora das vagas = lista de espera.
 *   - Outubro usa a grade da aba Prioridade, que diz exatamente os dias de cada reserva.
 *   - Avulsos de março/abril vêm da tabela de avulsos (sem o dia registrado).
 *
 * Uso: npm run importar
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { calcularPrioridade, calcularRateio, formatarReais, NOMES_MESES } from '../src/lib/calc.ts'
import type { Pesos } from '../src/lib/types.ts'

const ANO = 2026
const VAGAS = 15
const MULTIPLICADOR_AVULSO = 1.1
const PESOS: Pesos = { '1': 1, '2': 0.95, '3': 0.9, '4': 0.85, '5': 0.8 }
const MES_ATUAL = 10 // outubro ainda em andamento

// ---------- Jogadores (nomes usados hoje) e variações encontradas na planilha ----------
const JOGADORES = [
  'Alex', 'Bernardo Erthal', 'Bruno', 'Cadu', 'Caio C.', 'Daniel', 'Danilo', 'David', 'Deyvison',
  'Dimas', 'Douglas', 'Edson Sardine', 'Erick Lopes', 'Estevão', 'Francisco', 'Gabriel',
  'Gabriel Uhlmann', 'Gabrielzin', 'Ian', 'Igor Monteiro Da Silveira', 'Israel Sardinha', 'Jordan',
  'Leandro', 'Léo', 'Louri', 'Luis NJ', 'Maicon', 'Maikinho', 'Mayko Viana', 'Orlando', 'Pedro',
  'Pedro L.', 'Pedro Riba', 'Ricardo', 'Vinícius Avellar', 'Vinicius Nascimento', 'Vitão', 'Vitinho',
  'Ygor',
]
const VARIACOES: Record<string, string> = {
  'Estevão Barreto': 'Estevão',
  'Ricardo Mota': 'Ricardo',
  'Maicon Estevam Moreira': 'Maicon',
  'Pedro Renne': 'Pedro',
  'Ian França': 'Ian',
  Vitao: 'Vitão',
  'Gabriel Barreto': 'Gabriel',
  Davizinho: 'David',
  'David / Davizinho': 'David',
  Lourival: 'Louri',
  'Dimas Barroso': 'Dimas',
  'Jordan Filho': 'Jordan',
  'Francisco Junior': 'Francisco',
  'Vinicius Avellar': 'Vinícius Avellar',
  'Vinícius Nascimento': 'Vinicius Nascimento',
  Edson: 'Edson Sardine',
  Edinho: 'Edson Sardine',
  'Bruno Avellar': 'Bruno',
  Bernardo: 'Bernardo Erthal',
  Bernardoerthal: 'Bernardo Erthal',
  Erick: 'Erick Lopes',
}
function canonico(nome: string): string {
  const n = nome.trim()
  if (JOGADORES.includes(n)) return n
  if (VARIACOES[n]) return VARIACOES[n]
  throw new Error(`Nome desconhecido na planilha: "${n}"`)
}

// ---------- Leitura do markdown ----------
const md = readFileSync(new URL('../dados.md', import.meta.url), 'utf8')
const secoes = new Map<string, string[][]>()
{
  let atual: string[][] | null = null
  for (const linha of md.split(/\r?\n/)) {
    if (linha.startsWith('## ')) {
      atual = []
      secoes.set(linha.slice(3).trim(), atual)
    } else if (atual && linha.startsWith('|')) {
      const cel = linha.split('|').slice(1, -1).map((c) => c.trim())
      if (cel.every((c) => /^-+$/.test(c))) continue
      atual.push(cel.map((c) => (c === 'NaN' || c === '' ? '' : c)))
    }
  }
}
const num = (s: string) => Number(s)

interface MesPlanilha {
  mes: number
  custo: number
  reservas: { nome: string; dias: number; pago: boolean; valorPlanilha: number }[]
  avulsosSemDia: { nome: string; peladas: number }[]
}
const MESES_PLANILHA: MesPlanilha[] = []
for (const [i, nomeMes] of NOMES_MESES.entries()) {
  const linhas = secoes.get(nomeMes)
  if (!linhas) continue
  const [cab, ...dados] = linhas
  const m: MesPlanilha = { mes: i + 1, custo: num(cab[9]), reservas: [], avulsosSemDia: [] }
  let lendoAvulsos = false
  for (const c of dados) {
    if (c[0]) {
      m.reservas.push({
        nome: canonico(c[0]),
        dias: num(c[1]),
        pago: c[6] === 'Pago',
        valorPlanilha: num(c[5]),
      })
    }
    if (c[8] === 'Nome do Avulso') lendoAvulsos = true
    else if (lendoAvulsos && c[8] && c[9]) m.avulsosSemDia.push({ nome: canonico(c[8]), peladas: num(c[9]) })
  }
  m.reservas = m.reservas.filter((r) => r.dias > 0)
  MESES_PLANILHA.push(m)
}

// Aba Datas: blocos começando com "SÁBADO dd/mm"
const listas = new Map<string, string[]>() // data iso -> nomes em ordem
{
  let datas: string[] = []
  for (const c of secoes.get('Datas')!) {
    if (c[0]?.startsWith('SÁBADO')) {
      datas = c.filter((x) => x.startsWith('SÁBADO')).map((x) => {
        const [d, mm] = x.replace('SÁBADO', '').trim().split('/')
        return `${ANO}-${mm}-${d}`
      })
      for (const d of datas) listas.set(d, [])
      continue
    }
    datas.forEach((d, i) => c[i] && listas.get(d)!.push(canonico(c[i])))
  }
}

// Grade de outubro e prioridade da planilha (aba Prioridade de Reserva)
const gradeOutubro = new Map<string, Map<string, '1' | '0' | 'LE'>>() // data -> nome -> marca
const prioridadePlanilha = new Map<string, string>()
{
  const linhas = secoes.get('Prioridade de Reserva')!
  let colunasData: { col: number; data: string }[] = []
  for (const c of linhas) {
    if (c[4] && c[5] && c[4] !== 'Nome do Jogador' && !c[4].startsWith('Unnamed') && !c[4].startsWith('*') && !c[4].startsWith('A tabela')) {
      prioridadePlanilha.set(canonico(c[4]), c[5])
    }
    if (c[27] === 'Jogador') {
      colunasData = [29, 30, 31, 32, 33].map((col) => {
        const [d, mm] = c[col].split('/')
        return { col, data: `${ANO}-${mm}-${d}` }
      })
      continue
    }
    if (colunasData.length && c[27]) {
      const nome = canonico(c[27])
      for (const { col, data } of colunasData) {
        if (!gradeOutubro.has(data)) gradeOutubro.set(data, new Map())
        gradeOutubro.get(data)!.set(nome, c[col] as '1' | '0' | 'LE')
      }
    }
  }
}

// ---------- Montagem dos dados ----------
const jogadorId = new Map(JOGADORES.map((n) => [n, randomUUID()]))
interface MesOut { id: string; mes: number; custo: number; encerrado: boolean; observacao: string | null }
interface SabadoOut { id: string; mes_id: string; data: string }
interface PartOut {
  id: string; mes_id: string; sabado_id: string | null; jogador: string
  tipo: 'reserva' | 'avulso' | 'espera'; desistiu: boolean; ordem: number; observacao: string | null
}
const mesesOut: MesOut[] = []
const sabadosOut: SabadoOut[] = []
const partsOut: PartOut[] = []
const pagRateio: { mes_id: string; jogador: string; pago: boolean }[] = []
const relatorio: string[] = []
const avisos: string[] = []

const OBSERVACOES: Record<number, string> = {
  4: 'Planilha original somou 48,9 pontos (faltou o Bruno), valor do ponto 14,31 e arrecadou R$ 738,65. Avulso cobrado a R$ 15,98. Valores aqui estão corrigidos pela regra.',
  6: 'Planilha original lançou Edson com 3,4 pontos e R$ 21,30 manual (reservou 2 dias), arrecadando R$ 628,72. Valores aqui estão corrigidos pela regra.',
}

for (const m of MESES_PLANILHA) {
  const mes_id = randomUUID()
  mesesOut.push({ id: mes_id, mes: m.mes, custo: m.custo * 100, encerrado: m.mes < MES_ATUAL, observacao: OBSERVACOES[m.mes] ?? null })
  const datasMes = [...listas.keys()].filter((d) => Number(d.slice(5, 7)) === m.mes).sort()
  const sabadoId = new Map(datasMes.map((d) => [d, randomUUID()]))
  for (const d of datasMes) sabadosOut.push({ id: sabadoId.get(d)!, mes_id, data: d })

  const titulo = `${NOMES_MESES[m.mes - 1]}/${ANO}`
  const notas: string[] = []
  const add = (p: Omit<PartOut, 'id' | 'mes_id'>) => partsOut.push({ id: randomUUID(), mes_id, ...p })
  const reservou = new Map(m.reservas.map((r) => [r.nome, r.dias]))

  // tipo de cada pessoa em cada sábado
  const decisao = new Map<string, Map<string, { tipo: PartOut['tipo']; desistiu: boolean; ordem: number; observacao: string | null }>>()
  for (const d of datasMes) decisao.set(d, new Map())

  if (gradeOutubro.has(datasMes[0])) {
    // Mês com grade explícita de reservas
    for (const d of datasMes) {
      const grade = gradeOutubro.get(d)!
      listas.get(d)!.forEach((nome, i) => {
        const marca = grade.get(nome)
        const tipo = marca === '1' ? 'reserva' : marca === 'LE' || i >= VAGAS ? 'espera' : 'avulso'
        decisao.get(d)!.set(nome, { tipo, desistiu: false, ordem: i + 1, observacao: null })
      })
      for (const [nome, marca] of grade) {
        if (marca === '1' && !decisao.get(d)!.has(nome)) {
          decisao.get(d)!.set(nome, { tipo: 'reserva', desistiu: true, ordem: 99, observacao: 'Reservou mas não está na lista do dia' })
          notas.push(`${nome}: reservou ${d.slice(8)}/${d.slice(5, 7)} mas não está na lista desse dia → marcado como desistência.`)
        }
      }
    }
  } else {
    // Dedução pela aba do mês + aba Datas
    const usados = new Map<string, number>()
    for (const d of datasMes) {
      listas.get(d)!.forEach((nome, i) => {
        const ordem = i + 1
        if (i >= VAGAS) {
          decisao.get(d)!.set(nome, { tipo: 'espera', desistiu: false, ordem, observacao: null })
          return
        }
        const dias = reservou.get(nome) ?? 0
        const u = usados.get(nome) ?? 0
        if (u < dias) {
          usados.set(nome, u + 1)
          decisao.get(d)!.set(nome, { tipo: 'reserva', desistiu: false, ordem, observacao: null })
        } else {
          decisao.get(d)!.set(nome, { tipo: 'avulso', desistiu: false, ordem, observacao: null })
          if (dias > 0) notas.push(`${nome}: reservou ${dias} dia(s) mas está entre os ${VAGAS} em mais sábados → ${d.slice(8)}/${d.slice(5, 7)} lançado como **avulso**.`)
        }
      })
    }
    // Quem reservou mais dias do que aparece entre os 15: completa com desistência
    for (const [nome, dias] of reservou) {
      let falta = dias - (usados.get(nome) ?? 0)
      if (falta <= 0) continue
      const candidatos = [
        ...datasMes.filter((d) => decisao.get(d)!.get(nome)?.tipo === 'espera'),
        ...datasMes.filter((d) => !decisao.get(d)!.has(nome)),
      ]
      for (const d of candidatos) {
        if (falta === 0) break
        const estavaNaEspera = decisao.get(d)!.has(nome)
        decisao.get(d)!.set(nome, {
          tipo: 'reserva', desistiu: true, ordem: 99,
          observacao: estavaNaEspera ? 'Importação: estava fora dos 15 na planilha' : 'Importação: não aparece na lista do dia',
        })
        notas.push(`${nome}: reservou ${dias} dia(s) mas aparece entre os ${VAGAS} em só ${dias - falta} → ${d.slice(8)}/${d.slice(5, 7)} lançado como **reserva com desistência**${estavaNaEspera ? ' (estava fora dos 15 nesse dia)' : ' (não está na lista desse dia)'}.`)
        falta--
      }
      if (falta > 0) avisos.push(`${titulo}: ${nome} reservou ${dias} mas não foi possível alocar ${falta} dia(s).`)
    }
  }

  for (const d of datasMes) {
    for (const [nome, x] of decisao.get(d)!) add({ sabado_id: sabadoId.get(d)!, jogador: nome, ...x })
    const nRes = [...decisao.get(d)!.values()].filter((x) => x.tipo === 'reserva').length
    if (nRes > VAGAS) avisos.push(`${titulo} ${d}: ${nRes} reservas para ${VAGAS} vagas.`)
  }
  for (const a of m.avulsosSemDia) {
    for (let k = 0; k < a.peladas; k++) {
      add({ sabado_id: null, jogador: a.nome, tipo: 'avulso', desistiu: false, ordem: 0, observacao: 'Importação: dia não registrado na planilha' })
    }
  }
  for (const r of m.reservas) pagRateio.push({ mes_id, jogador: r.nome, pago: r.pago })

  // Conferência dos dias reservados
  for (const [nome, dias] of reservou) {
    const n = partsOut.filter((p) => p.mes_id === mes_id && p.jogador === nome && p.tipo === 'reserva').length
    if (n !== dias) avisos.push(`${titulo}: ${nome} tem ${dias} reservas na aba do mês e ${n} lançadas.`)
  }

  // Rateio calculado x planilha
  const partsMes = partsOut.filter((p) => p.mes_id === mes_id)
  const rateio = calcularRateio(
    { custo_campo_centavos: m.custo * 100, abatimento_caixa_centavos: 0, pesos: PESOS, avulso_multiplicador: MULTIPLICADOR_AVULSO },
    partsMes.map((p) => ({ jogador_id: p.jogador, tipo: p.tipo })),
  )
  const avulsos = partsMes.filter((p) => p.tipo === 'avulso')
  relatorio.push(`## ${titulo}`, '')
  relatorio.push(`Campo: ${formatarReais(m.custo * 100)} · Total de pontos: ${rateio.total_pontos.toFixed(1).replace('.', ',')} · Valor do ponto: ${formatarReais(Math.round(rateio.valor_ponto!))} · Avulso: ${formatarReais(rateio.valor_avulso_centavos!)} por pelada`, '')
  const difs = m.reservas
    .map((r) => {
      const calc = rateio.linhas.find((l) => l.jogador_id === r.nome)!.valor_centavos
      return { ...r, calc, plan: Math.round(r.valorPlanilha * 100) }
    })
    .filter((x) => Math.abs(x.calc - x.plan) > 1)
  if (difs.length) {
    relatorio.push('**Valores diferentes da planilha (sistema usa o valor da regra):**', '', '| Jogador | Dias | Planilha | Sistema |', '| --- | --- | --- | --- |')
    for (const x of difs) relatorio.push(`| ${x.nome} | ${x.dias} | ${formatarReais(x.plan)} | ${formatarReais(x.calc)} |`)
    relatorio.push('')
  } else relatorio.push('Rateio confere com a planilha.', '')
  if (avulsos.length) {
    const porJogador = new Map<string, number>()
    for (const a of avulsos) porJogador.set(a.jogador, (porJogador.get(a.jogador) ?? 0) + 1)
    relatorio.push(`**Avulsos (${avulsos.length} peladas = ${formatarReais(avulsos.length * rateio.valor_avulso_centavos!)} no caixa):** ` +
      [...porJogador].map(([n, q]) => `${n} (${q})`).join(', '), '')
  }
  const espera = partsMes.filter((p) => p.tipo === 'espera').length
  if (espera) relatorio.push(`Lista de espera: ${espera} registro(s).`, '')
  if (notas.length) relatorio.push('**Para conferir:**', '', ...notas.map((n) => `- ${n}`), '')
}

// ---------- Prioridade recalculada x planilha ----------
const sabadosParaCalc = sabadosOut.map((s) => ({ id: s.id, data: s.data }))
const prio = calcularPrioridade(
  partsOut.map((p) => ({ jogador_id: p.jogador, tipo: p.tipo, sabado_id: p.sabado_id })),
  sabadosParaCalc, [], `${ANO}-10-01`,
)
const linhasPrio = [...prio.values()].sort((a, b) => b.pontos - a.pontos || a.jogador_id.localeCompare(b.jogador_id))
const secPrio = ['## Prioridade (reservas de março a setembro)', '', '| Jogador | Sistema | Planilha |', '| --- | --- | --- |']
for (const l of linhasPrio) {
  const plan = prioridadePlanilha.get(l.jogador_id) ?? '—'
  const marca = plan !== '—' && Number(plan) !== l.pontos ? ' ⚠️' : ''
  secPrio.push(`| ${l.jogador_id} | ${l.pontos} | ${plan}${marca} |`)
}

// ---------- Saída: relatório ----------
writeFileSync(
  new URL('../docs/relatorio-importacao.md', import.meta.url),
  [
    '# Relatório de importação da planilha',
    '',
    'Gerado por `npm run importar`. Mostra o que foi deduzido da planilha e o que precisa de conferência.',
    'Para corrigir algo, ajuste depois no app (área do admin) ou edite as regras em `scripts/importar.ts` e rode de novo.',
    '',
    '### Regras usadas',
    '',
    '- Aba do mês = reservas antecipadas (rateio e prioridade).',
    `- Aba Datas: dentro das ${VAGAS} vagas e sem reserva = avulso (pago); fora das ${VAGAS} = lista de espera.`,
    '- Outubro: dias de reserva vindos da grade da aba Prioridade.',
    '- Março/abril: avulsos da tabela de avulsos, sem dia registrado.',
    `- Avulso paga valor do ponto × ${String(MULTIPLICADOR_AVULSO).replace('.', ',')}.`,
    '',
    avisos.length ? '### ⚠️ Avisos\n\n' + avisos.map((a) => `- ${a}`).join('\n') + '\n' : '### Nenhum aviso grave\n',
    ...secPrio,
    '',
    ...relatorio,
  ].join('\n'),
)

// ---------- Saída: seed.sql ----------
const q = (s: string | null) => (s === null ? 'null' : `'${s.replace(/'/g, "''")}'`)
const sql: string[] = [
  '-- Gerado por `npm run importar` a partir de dados.md. Rode DEPOIS de migrations/0001_esquema.sql.',
  'begin;',
  '',
  'insert into jogadores (id, nome) values',
  JOGADORES.map((n) => `  (${q(jogadorId.get(n)!)}, ${q(n)})`).join(',\n') + ';',
  '',
  'insert into meses (id, ano, mes, custo_campo_centavos, pesos, avulso_multiplicador, encerrado, observacao) values',
  mesesOut.map((m) => `  (${q(m.id)}, ${ANO}, ${m.mes}, ${m.custo}, ${q(JSON.stringify(PESOS))}, ${MULTIPLICADOR_AVULSO}, ${m.encerrado}, ${q(m.observacao)})`).join(',\n') + ';',
  '',
  'insert into sabados (id, mes_id, data, vagas) values',
  sabadosOut.map((s) => `  (${q(s.id)}, ${q(s.mes_id)}, ${q(s.data)}, ${VAGAS})`).join(',\n') + ';',
  '',
  'insert into participacoes (id, mes_id, sabado_id, jogador_id, tipo, desistiu, ordem, observacao) values',
  partsOut.map((p) => `  (${q(p.id)}, ${q(p.mes_id)}, ${q(p.sabado_id)}, ${q(jogadorId.get(p.jogador)!)}, ${q(p.tipo)}, ${p.desistiu}, ${p.ordem}, ${q(p.observacao)})`).join(',\n') + ';',
  '',
  'insert into pagamentos_rateio (mes_id, jogador_id, pago, pago_em) values',
  pagRateio.map((p) => `  (${q(p.mes_id)}, ${q(jogadorId.get(p.jogador)!)}, ${p.pago}, ${p.pago ? 'now()' : 'null'})`).join(',\n') + ';',
  '',
  '-- Avulsos do histórico: todos pagos',
  "insert into pagamentos_avulso (participacao_id, pago, pago_em) select id, true, now() from participacoes where tipo = 'avulso';",
  '',
  "update configuracoes set vagas_padrao = 15, custo_campo_padrao_centavos = 80000, avulso_multiplicador = 1.1, pesos = '" + JSON.stringify(PESOS) + "' where id = 1;",
  '',
  'commit;',
  '',
]
writeFileSync(new URL('../supabase/seed.sql', import.meta.url), sql.join('\n'))

console.log(`Jogadores: ${JOGADORES.length} · Meses: ${mesesOut.length} · Sábados: ${sabadosOut.length} · Participações: ${partsOut.length}`)
console.log(`Avisos: ${avisos.length}`)
avisos.forEach((a) => console.log('  - ' + a))
console.log('Gerados: supabase/seed.sql e docs/relatorio-importacao.md')
