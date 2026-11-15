---
name: saude-das-entregas
description: Confere as entregas ao cliente — clipping diário por e-mail, pacote mensal do Claude Design e relatório. Use antes de o dono enviar algo ao cliente e quando um e-mail ou pacote não chegar.
---

# Saúde das entregas
1. **E-mail diário:**
   - `SELECT client_id, day, mode, status, recipients_count, error FROM clipping_email_sends ORDER BY created_at DESC LIMIT 20;` mostra o que saiu.
   - `erro`: o detalhe diz se é domínio não verificado, falta de remetente ou falta de destinatário.
   - `enviando` há mais de 10 min: o próximo disparo retoma.
2. **Prévia sem envio:** Clipping → "Ver e-mail do dia". Confira se os links abrem a matéria exata e se o tom só aparece quando foi revisado.
3. **Pacote do mês:** baixe em `/reports/prepare` ("Pacote Claude Design"). A seção "Pontos a corrigir" precisa estar vazia ou explicada:
   - 20 itens, todos do mês e com link exato;
   - a marca certa (ONS = CRT, PRIO = VX, demais = SAUZ);
   - nenhum nome proibido.
4. **Calibração:** `docs/calibracao/recall-2026-10.sql`. Coletado e etiquetado contra o que foi entregue, por cliente.
