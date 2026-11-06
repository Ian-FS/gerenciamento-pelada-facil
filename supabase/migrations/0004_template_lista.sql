-- Template da mensagem da lista de cada dia (botão "Compartilhar" na página Peladas).
-- null = usa o template padrão do app. Edite em Configurações → Mensagem da lista.
-- Rode no SQL Editor do Supabase depois de 0003.

alter table configuracoes add column template_lista text;
