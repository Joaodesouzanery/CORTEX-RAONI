---
name: saude-do-deploy
description: Confere se a produção da Vercel está no ar, com o commit esperado e as variáveis certas, e se os segredos do GitHub apontam para ela. Use depois de qualquer merge, quando um workflow falhar com erro de URL, ou quando o dono não vir uma mudança que foi feita.
---

# Saúde do deploy
**Projeto Vercel:** `cortexintel`.
- **Produção:** `cortexreputacional.vercel.app`, a partir da branch `claude/busy-knuth-aynxlz`.
- **Prévias:** exigem login da Vercel. O dono não vê prévia como se fosse produção.

1. **Qual commit está em produção?** Vercel MCP `list_deployments` com `target: production`, ou o painel da Vercel. Compare com o último commit da branch de produção. Mudança que só está em outra branch não está no site.
2. **Variáveis:** `filter_project_envs` mostra os nomes, nunca os valores.
   - **Obrigatórias:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `CRON_SECRET`.
   - **Opcionais:** Anthropic (`docs/prompt-mestre.md`) e Resend (`docs/email.md`).
3. **Segredos do GitHub** (Settings → Secrets → Actions):
   - `APP_URL` = `https://cortexreputacional.vercel.app`, nunca uma URL de deploy com hash;
   - `CRON_SECRET` igual ao da Vercel;
   - `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`, para o vigia olhar o banco.
4. **Erros em produção:** Vercel MCP `get_runtime_errors` nos últimos 7 dias.

Nunca imprima o valor de um segredo.
