-- Vínculo com o app Pelada Fácil Sorteio (Firebase).
-- Rode no SQL Editor do Supabase depois de 0001_esquema.sql.
--
-- sorteio_id é o id do jogador lá (peladas/{peladaId}/players/{id}). É por ele que a
-- votação dos sábados, feita no Sorteio, chega aos pedidos do Novo mês. Nome serve só
-- para sugerir o vínculo; nulo = jogador ainda não vinculado.

alter table jogadores add column sorteio_id text unique;
