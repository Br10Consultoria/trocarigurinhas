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

- [ ] Publicar esta funcionalidade de histórico no GitHub e validar o commit remoto com tabela, procedure e rota de perfil.
- [ ] Adicionar teste do fluxo de conclusão de reserva gerando uma negociação e disponibilizando-a no histórico.
