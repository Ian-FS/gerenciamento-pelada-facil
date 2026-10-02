-- Pelada Fácil — esquema inicial
-- Rode este arquivo no SQL Editor do Supabase (ou via `supabase db push`).
--
-- Princípio: o banco guarda só FATOS (quem reservou, quem jogou avulso, quem ficou na espera,
-- custo do campo, pesos). Valores do rateio, valor do avulso, caixa e prioridade são CALCULADOS
-- no app (src/lib/calc.ts), então nunca ficam inconsistentes.


-- Configurações gerais (linha única). Cada mês copia esses valores ao ser criado,
-- para que mudar a configuração não altere meses passados.
create table configuracoes (
  id int primary key default 1 check (id = 1),
  vagas_padrao int not null default 15 check (vagas_padrao > 0),
  custo_campo_padrao_centavos int not null default 80000 check (custo_campo_padrao_centavos >= 0),
  avulso_multiplicador numeric(5,3) not null default 1.10 check (avulso_multiplicador > 0),
  pesos jsonb not null default '{"1":1,"2":0.95,"3":0.9,"4":0.85,"5":0.8}'
);
insert into configuracoes (id) values (1);

create table jogadores (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table meses (
  id uuid primary key default gen_random_uuid(),
  ano int not null,
  mes int not null check (mes between 1 and 12),
  custo_campo_centavos int not null check (custo_campo_centavos >= 0),
  -- quanto do caixa extra (avulsos) foi usado para abater o custo do campo neste mês
  abatimento_caixa_centavos int not null default 0 check (abatimento_caixa_centavos >= 0),
  pesos jsonb not null,
  avulso_multiplicador numeric(5,3) not null,
  encerrado boolean not null default false,
  observacao text,
  unique (ano, mes)
);

-- Cada dia de pelada do mês
create table sabados (
  id uuid primary key default gen_random_uuid(),
  mes_id uuid not null references meses(id) on delete cascade,
  data date not null unique,
  vagas int not null check (vagas > 0),
  observacao text
);
create index on sabados (mes_id);

-- Quem está na lista de cada sábado e como entrou:
--   reserva : reservou antecipadamente (entra no rateio e conta prioridade).
--             desistiu = true -> não vai jogar, mas já pagou e continua contando.
--   avulso  : entrou na semana da pelada; paga valor do ponto x multiplicador, não conta prioridade.
--   espera  : lista de espera daquele sábado.
-- sabado_id pode ser nulo só para avulsos históricos cujo dia não foi registrado na planilha.
create table participacoes (
  id uuid primary key default gen_random_uuid(),
  mes_id uuid not null references meses(id) on delete cascade,
  sabado_id uuid references sabados(id) on delete cascade,
  jogador_id uuid not null references jogadores(id) on delete restrict,
  tipo text not null check (tipo in ('reserva', 'avulso', 'espera')),
  desistiu boolean not null default false,
  ordem int not null default 0,
  observacao text,
  criado_em timestamptz not null default now(),
  check (not desistiu or tipo = 'reserva'),
  check (sabado_id is not null or tipo = 'avulso')
);
create unique index participacoes_sabado_jogador on participacoes (sabado_id, jogador_id) where sabado_id is not null;
create index on participacoes (mes_id);
create index on participacoes (jogador_id);

-- Pagamento da cota mensal (rateio). Sem linha = pendente.
create table pagamentos_rateio (
  mes_id uuid not null references meses(id) on delete cascade,
  jogador_id uuid not null references jogadores(id) on delete cascade,
  pago boolean not null default false,
  pago_em timestamptz,
  -- desconto (negativo) ou acréscimo (positivo) manual sobre o valor calculado
  ajuste_centavos int not null default 0,
  observacao text,
  primary key (mes_id, jogador_id)
);

-- Pagamento de cada pelada avulsa. Sem linha = pendente.
create table pagamentos_avulso (
  participacao_id uuid primary key references participacoes(id) on delete cascade,
  pago boolean not null default false,
  pago_em timestamptz
);

-- Ajustes manuais da prioridade: 'zerar' descarta tudo antes da data; 'ajuste' soma/subtrai pontos.
create table ajustes_prioridade (
  id uuid primary key default gen_random_uuid(),
  jogador_id uuid not null references jogadores(id) on delete cascade,
  tipo text not null check (tipo in ('zerar', 'ajuste')),
  valor int not null default 0,
  data date not null default current_date,
  motivo text,
  criado_em timestamptz not null default now()
);

-- Administradores: usuários do Supabase Auth com permissão de escrita.
create table admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

-- ---------- Permissões (RLS) ----------
alter table configuracoes enable row level security;
alter table jogadores enable row level security;
alter table meses enable row level security;
alter table sabados enable row level security;
alter table participacoes enable row level security;
alter table pagamentos_rateio enable row level security;
alter table pagamentos_avulso enable row level security;
alter table ajustes_prioridade enable row level security;
alter table admins enable row level security;

-- Leitura pública (qualquer visitante) + escrita só para admin
do $$
declare t text;
begin
  foreach t in array array['configuracoes','jogadores','meses','sabados','participacoes','ajustes_prioridade'] loop
    execute format('create policy "leitura publica" on %I for select using (true)', t);
    execute format('create policy "admin escreve" on %I for all to authenticated using (is_admin()) with check (is_admin())', t);
  end loop;
  -- Pagamentos: só o admin vê e altera
  foreach t in array array['pagamentos_rateio','pagamentos_avulso'] loop
    execute format('create policy "admin total" on %I for all to authenticated using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

create policy "ver o proprio registro" on admins for select to authenticated using (user_id = auth.uid());

grant usage on schema public to anon, authenticated;
grant select on configuracoes, jogadores, meses, sabados, participacoes, ajustes_prioridade to anon, authenticated;
grant insert, update, delete on configuracoes, jogadores, meses, sabados, participacoes, ajustes_prioridade,
  pagamentos_rateio, pagamentos_avulso to authenticated;
grant select on pagamentos_rateio, pagamentos_avulso, admins to authenticated;
grant execute on function is_admin() to anon, authenticated;
