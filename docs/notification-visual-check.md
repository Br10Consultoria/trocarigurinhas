# Revisão visual — notificações em tempo real

A revisão visual foi executada nas rotas `/` e `/perfil` em viewport desktop de 1280×720 e mobile de 375×812. O sino de notificações permanece acessível no cabeçalho do marketplace, do perfil e das áreas autenticadas compartilhadas.

A central apresenta a quantidade de pendências em um badge textual e oferece a ação `Marcar todas como lidas` em desktop, com o rótulo compacto `Ler todas` no mobile. O cabeçalho do popover se reorganiza em telas menores, mantendo a ação acessível. As capturas mobile também confirmaram que o cabeçalho, a busca, os filtros e as abas do perfil não apresentam corte ou sobreposição.

A ação usa atualização otimista: o contador é zerado e os itens são marcados como lidos imediatamente; em caso de erro, o estado anterior é restaurado e uma mensagem visual explica o problema. O polling de 60 segundos permanece apenas como fallback para recuperar eventos quando a conexão SSE estiver indisponível.
