---
name: saude-dos-workflows
description: Confere se os workflows do GitHub Actions (fetch-news, watchdog, e-mail diário, pacote mensal) estão rodando e por que falham. Use ao começar qualquer sessão de trabalho, quando o vigia abrir a Issue `saude`, ou quando um dado "parou de atualizar".
---

# Saúde dos workflows
1. Liste as últimas execuções de cada workflow agendado (GitHub MCP `actions_list` → `list_workflow_runs`, ou a aba Actions).
   - `fetch-news.yml`: 3 vezes por dia (10h, 15h e 21h UTC).
   - `watchdog.yml`: a cada 3 h.
   - `daily-clipping-email.yml`: dias úteis.
2. **Falha em menos de 15 s:** é quase sempre segredo ou URL, não código. Leia o log (`get_job_logs`) e procure:
   - `DEPLOYMENT_NOT_FOUND`: o `APP_URL` aponta para um deploy apagado (foi a causa de 15/09 a 14/11/2026). Correção: `APP_URL = https://cortexreputacional.vercel.app`.
   - `HTTP 401`: o `CRON_SECRET` do GitHub difere do da Vercel.
   - `HTTP 503` com "não configurado": falta variável na Vercel; o passo diz qual.
3. **Agendamento comentado:** confira se o `schedule:` do arquivo não está desligado. Os desligados de propósito são `monthly-package` e `monthly-clipping`.
4. A branch padrão do repositório é a que roda o agendamento. Mudança só em outra branch não chega ao cron.

**Regra:** passo verde do health check dentro do `fetch-news` não prova saúde, porque ele roda no mesmo pipeline. A prova é o `watchdog.yml` verde.
