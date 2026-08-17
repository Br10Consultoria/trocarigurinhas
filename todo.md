# Troca Figurinhas — TODO

- [x] Projeto web fullstack inicializado com autenticação Manus, React, Tailwind, Express, tRPC e Drizzle.
- [x] Repositório GitHub `Br10Consultoria/trocarigurinhas` identificado para sincronização.
- [x] Validar e restaurar as funcionalidades de figurinhas, reservas, 2FA e painel administrativo após a restauração do sandbox.
- [x] Executar testes, revisar o build e salvar checkpoint antes da publicação.
- [x] Disponibilizar domínio HTTPS gerenciado e documentar configuração Nginx/SSL para infraestrutura própria.

## Nota de estado

As funcionalidades de backend presentes no checkpoint foram reconstruídas e validadas com checagem TypeScript, testes e build. A interface de marketplace foi atualizada com busca e filtros.

- [x] Adicionar busca por número, nome do jogador e observações no marketplace.
- [x] Adicionar filtros por campeonato, tipo de figurinha, condição e ordenação.
- [x] Implementar estados de carregamento, nenhum resultado e limpeza de filtros.
- [x] Criar testes para os parâmetros de busca e filtros do marketplace.


## Pendências de segurança e administração

- [x] Exibir e gerenciar figurinhas e reservas ativas no painel administrativo.
- [x] Tornar o 2FA obrigatório por sessão para liberar operações administrativas após o login.
- [x] Registrar o job Heartbeat de expiração automática após o deploy; task UID `EJY68STFBrMhnEy9rjPD26`, execução horária.
- [x] Separar claramente HTTPS gerenciado do Manus e o guia opcional de Nginx/SSL próprio.


## Política de entrega

- [x] Enviar a versão atual ao GitHub e verificar o commit remoto.
- [x] Sincronizar obrigatoriamente futuras atualizações validadas com o repositório GitHub antes da entrega ao usuário.


## Histórico de negociações

- [x] Criar tabela de negociações concluídas com tipo troca ou compra e vínculo com a reserva.
- [x] Criar procedure autenticada para listar o histórico do usuário.
- [x] Criar aba de histórico no perfil com filtros por tipo e estado vazio.
- [x] Adicionar testes, validar build e publicar a atualização no GitHub.


## Verificação final do histórico

- [x] Publicar esta funcionalidade de histórico no GitHub e validar o commit remoto com tabela, procedure e rota de perfil.
- [x] Adicionar teste do fluxo de conclusão de reserva gerando uma negociação e disponibilizando-a no histórico.


## Cobertura de integração do histórico

- [x] Cobrir em teste o fluxo completo de concluir uma reserva e consultar a negociação no histórico do usuário.
- [x] Executar novamente os testes e sincronizar o ajuste no GitHub.


## Fechamento após integração real

- [x] Teste de integração real sem mock, concluindo reserva e lendo o registro no histórico.
- [x] Executar a suíte completa e publicar o teste de integração atualizado no GitHub com SHA remoto verificado.


## Notificações de negociações

- [x] Criar tabela persistente de notificações por usuário com estado lida/não lida.
- [x] Gerar notificações quando uma troca for aceita ou finalizada.
- [x] Criar procedures autenticadas para listar, marcar como lida e marcar todas como lidas.
- [x] Adicionar toast visual imediato, contador e central de notificações no frontend.
- [x] Testar, validar, publicar no GitHub e salvar checkpoint da atualização.


## Ajuste visual identificado na validação

- [x] Corrigir o overflow das abas do perfil em viewport móvel de 375px.


## Entrega imediata de eventos

- [x] Adicionar canal SSE autenticado com heartbeat e limpeza de conexões.
- [x] Garantir que o aceite de reserva gere a notificação usando o ID real da reserva.
- [x] Cobrir a entrega SSE e o novo contrato de reserva nos testes.


## Leitura em massa de notificações

- [x] Destacar o botão para marcar todas as notificações pendentes como lidas.
- [x] Exibir quantidade de pendências e feedback de sucesso/erro após a ação.
- [x] Validar responsividade, testes e sincronização no GitHub.


## Fechamento da leitura em massa

- [x] Publicar a melhoria da central de notificações no GitHub e validar o SHA remoto após o push.
- [x] Salvar checkpoint final da melhoria de leitura em massa após a sincronização remota.


## Checkpoint pós-publicação

- [x] Salvar um novo checkpoint após a melhoria de leitura em massa já sincronizada no GitHub, garantindo correspondência com o commit remoto `f66ef95`.


## Filtros por tipo de notificação

- [x] Adicionar categorias de troca, compra e aviso do sistema no modelo de notificação.
- [x] Implementar filtro por tipo com contadores e estado vazio específico.
- [x] Preservar SSE, leitura em massa e responsividade nos filtros.
- [x] Testar a suíte completa de notificações e tipos.
- [x] Salvar checkpoint da atualização de filtros de notificação.

## Ações rápidas na aba Trocas

- [x] Separar backend e contratos entre aceitar uma proposta e concluir a troca.
- [x] Atualizar a consulta de notificações para expor o `reservationId` e indicar propostas ativas.
- [x] Adicionar ações rápidas que aceitem ou recusem a proposta sem concluir a negociação automaticamente.
- [x] Cobrir os novos cenários com testes.
- [ ] Executar o build completo e salvar o checkpoint da nova funcionalidade.
