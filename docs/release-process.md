# Processo obrigatório de release

Toda alteração validada do Troca Figurinhas deve ser sincronizada com o repositório GitHub `Br10Consultoria/trocarigurinhas` antes de ser comunicada como entregue.

## Fluxo

1. Registrar a alteração em `todo.md` antes da implementação.
2. Executar `pnpm check`, `pnpm test` e `pnpm build`.
3. Revisar o estado do projeto com `git status` e confirmar que nenhum arquivo necessário ficou fora do commit.
4. Criar um commit descritivo na branch `main`.
5. Executar `git push github main`.
6. Confirmar no GitHub a SHA da branch `main` e a existência dos arquivos principais alterados.
7. Só então informar a entrega ao usuário, incluindo o link do commit.

## Regras de segurança

O remoto `github` deve apontar para o repositório oficial. Segredos, tokens, arquivos `.env`, credenciais e dados pessoais nunca devem ser adicionados ao commit. Se o push retornar `403`, a versão não deve ser declarada como publicada; o problema de autorização precisa ser resolvido antes da entrega.

## Verificação rápida

```bash
git status --short
git log --oneline -1
git push github main
gh api repos/Br10Consultoria/trocarigurinhas/branches/main --jq '.commit.sha'
```
