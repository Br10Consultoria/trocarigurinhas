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
- [ ] Registrar o job Heartbeat de expiração automática após o próximo deploy; o endpoint já está montado.
- [x] Separar claramente HTTPS gerenciado do Manus e o guia opcional de Nginx/SSL próprio.


## Política de entrega

- [ ] Enviar a versão atual ao GitHub e verificar o commit remoto.
- [ ] Sincronizar obrigatoriamente futuras atualizações validadas com o repositório GitHub antes da entrega ao usuário.
