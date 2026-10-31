---
name: seguranca-de-rotas
description: Checklist de segurança para rota nova ou alterada. Use SEMPRE ao tocar em src/app/api, middleware, service role ou chamada paga à Anthropic.
---

# Segurança de rotas
Hoje toda rota nasce pública e roda com service role.
1. Declare no PR o que a rota expõe e quanto custa.
2. Valide entrada com Zod; nada de entrada crua em filtro PostgREST.
3. URL de terceiro só com `safeFetch`; `href` com `safeExternalUrl`.
4. Rota com custo de IA precisa de proteção e limite.
5. Não devolva segredo, stack trace ou dado de outro cliente.
6. Tabela nova: RLS na mesma migration, zero policies.
7. Rode `repo-invariants.test.ts`.
