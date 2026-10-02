# ⚽ Pelada Fácil

Gestão da pelada: reservas antecipadas com prioridade, lista de espera, avulsos, rateio do campo e controle de pagamentos.
React + TypeScript + Vite + Tailwind + Supabase.

- **Público (sem login):** lista de prioridade e listas de cada sábado.
- **Admin (login):** financeiro (rateio, avulsos, caixa), criação do mês com distribuição automática das reservas, jogadores, configurações.

## Colocando no ar

### 1. Supabase
1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, rode nesta ordem:
   1. `supabase/migrations/0001_esquema.sql` (tabelas e permissões)
   2. `supabase/seed.sql` (histórico de março a outubro/2026 importado da planilha)
3. Em **Authentication → Sign In / Providers**, desative *Allow new users to sign up* (só o admin entra).
4. Em **Authentication → Users → Add user**, crie o usuário do admin (e-mail e senha, marque *Auto Confirm*).
5. Libere esse usuário como admin no SQL Editor:
   ```sql
   insert into admins (user_id) select id from auth.users where email = 'seu-email@exemplo.com';
   ```

### 2. App
```bash
cp .env.example .env.local   # preencha com Project Settings → API (URL e anon/publishable key)
npm install
npm run dev
```
Para publicar: Vercel ou Netlify (os arquivos de rota `vercel.json` e `public/_redirects` já estão prontos). Configure as mesmas variáveis `VITE_SUPABASE_*` no painel.

## Regras de negócio

| Situação | Paga | Conta prioridade |
|---|---|---|
| **Reserva antecipada** | Rateio do campo com peso por dias reservados | Sim, 1 ponto por reserva |
| **Reserva com desistência** | Já pagou, sem devolução | Sim |
| **Avulso** (entra na semana, se houver vaga) | Valor do ponto × 1,10, por pelada → vai para o caixa extra | Não |
| **Lista de espera** | Nada | Não |

- **Rateio:** `pontos = dias × peso`; `valor do ponto = (custo do campo − abatimento do caixa) ÷ total de pontos`; `cota = pontos × valor do ponto`. Valores em centavos, e a soma sempre fecha o valor exato.
- **Pesos** (configurável): 1 dia 1,00 · 2 dias 0,95 · 3 dias 0,90 · 4 dias 0,85 · 5 dias 0,80.
- **Distribuição das reservas:** em cada sábado, os pedidos são ordenados pela prioridade (reservas acumuladas até o fim do mês anterior). As vagas (padrão 15) viram reserva e o resto vai para a lista de espera daquele sábado. Empates são decididos pelo admin.
- **Prioridade:** acumula para sempre. O admin pode **zerar** (jogador saiu e voltou) ou **ajustar** manualmente.
- **Caixa extra:** soma dos avulsos pagos. O admin pode usar parte dele para abater o campo de um mês.
- Cada mês guarda seus pesos e multiplicador, então mudar a configuração não altera o passado.

O banco guarda só fatos (quem reservou, quem jogou avulso, quem ficou na espera). Valores e prioridade são calculados em `src/lib/calc.ts` (com testes: `npm test`).

## Histórico importado

`npm run importar` lê `dados.md` e gera `supabase/seed.sql` e `docs/relatorio-importacao.md`. O relatório lista o que foi deduzido e o que vale conferir.
Rode de novo só antes de carregar o banco: o seed gera IDs novos a cada execução.
