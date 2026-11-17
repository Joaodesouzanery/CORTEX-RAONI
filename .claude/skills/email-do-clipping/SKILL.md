---
name: email-do-clipping
description: Desenho, revisão e envio do clipping diário por e-mail (Gmail com senha de app ou Resend). Use ao mexer em src/lib/clipping-email*.ts, src/lib/email.ts, na rota /api/internal/clipping-email ou no workflow daily-clipping-email.
---

# E-mail do clipping
- **Formato:** `docs/referencia-relatorios/2026-10-destaques/formato-clipping-diario.md`.
  - Cliente primeiro, agrupado por fato, com o tom só quando revisado.
  - "Em setor" com até 3 itens.
  - Temas do mês, histórico e rodapé com o denominador.
- **Envio:** o agendado sempre em `review` (só o dono); o cliente só com `mode=send`. Destinatários do cliente em cópia oculta.
- **Idempotente:** `clipping_email_sends` (cliente, dia, modo). Erro e reserva parada há mais de 10 min são retomáveis.
- **Nunca a íntegra:** título, veículo, link e resumo próprio. Texto de terceiro escapado; href por `safeExternalUrl`.
- **LGPD:** `client_email_recipients` só via service role; o registro guarda quantos receberam, nunca quem.
- **Configuração:** `docs/email.md`.
