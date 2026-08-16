# Revisão visual — notificações em tempo real

A revisão visual foi executada nas rotas `/` e `/perfil` em viewport desktop de 1280×720 e na rota `/` em viewport móvel de 375×812.

A interface apresenta o sino de notificações no cabeçalho, o contador permanece reservado para notificações não lidas e o estado `Atualização em tempo real` é exibido junto ao marketplace. A central mantém largura responsiva, rolagem interna e ações de leitura. No mobile, o sino, logout, busca e filtros permanecem acessíveis sem sobreposição ou corte; o conteúdo principal segue verticalmente com o layout adaptado.

Após a implementação do SSE, o indicador da central alterna entre `Atualização em tempo real` e `Reconectando canal seguro...` conforme o estado da conexão. O polling de 60 segundos permanece apenas como fallback para recuperar eventos quando a conexão SSE estiver indisponível.
