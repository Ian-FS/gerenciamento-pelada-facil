-- Dias da semana em que a pelada costuma acontecer (0 = domingo … 6 = sábado).
-- Só define a SUGESTÃO ao criar um mês ou abrir a votação: qualquer data do mês pode ser
-- incluída ou retirada na hora. Rode no SQL Editor do Supabase depois de 0002.

alter table configuracoes
  add column dias_semana_padrao int[] not null default '{6}'
  check (dias_semana_padrao <@ array[0, 1, 2, 3, 4, 5, 6]);
