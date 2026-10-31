> **Atualização 31/10/2026:** `fetch-news.yml` religado, 3x/dia (07h, 12h, 18h BRT), a pedido do usuário. Depende dos secrets `APP_URL` e `CRON_SECRET`. Os demais crons seguem desligados.

# Status dos crons — 2026-10-04

## O que foi pedido

O "Alerts digest" falhava todo dia (e-mail do GitHub às 08h BRT, job encerrado em
4 segundos). Pedido: resolver ou remover esse cron; se algum cron ficar, só 1x/dia;
e, por enquanto, **desligar todos** e reportar aqui o que existe e como resolver.

## Diagnóstico

**Causa: faltam os secrets `APP_URL` e `CRON_SECRET` no GitHub** (Settings →
Secrets and variables → Actions, no repo `Joaodesouzanery/CORTEX-RAONI`).

A prova está no próprio log: o job falha em **4 segundos**, e os workflows
começam todos pela mesma checagem:
```bash
if [ -z "${APP_URL}" ]; then
  echo "Missing APP_URL repo secret..." >&2
  exit 1
fi
```
Essa checagem é local — não toca a rede. Um timeout de verdade levaria até
120s (`--max-time 120`). 4 segundos só bate com essa linha abortando sem nunca
tentar o `curl`. Não tenho `gh` instalado nesta máquina para confirmar
diretamente a lista de secrets do repo, mas a evidência do tempo é conclusiva,
e o `README.md` do próprio projeto (linhas 37-38, 46-47) documenta que os
dois secrets são obrigatórios para os jobs agendados.

**Isso não afeta só o Alerts digest — os 4 workflows com `schedule:` têm o
mesmo guard e provavelmente estavam todos falhando:**

| Workflow | Frequência antes | O que faz |
|---|---|---|
| `alerts.yml` | 1x/dia (11:00 UTC / ~08:00 BRT) | Dispara `/api/alerts/check` — digest de alertas por e-mail |
| `fetch-news.yml` | **4x/dia** (a cada 6h) | Coleta de notícias (fontes → classificação → enriquecimento) |
| `monthly-clipping.yml` | 1x/mês (dia 1, ~08:00 BRT) | Fecha e renderiza os clippings mensais por cliente |
| `report-automation.yml` | **2x/dia** (00h15 e 04h15 BRT) + 1x/mês | Preparação mensal contínua (2 crons: diário + virada de mês) |

Só o `alerts.yml` manda e-mail de falha porque é o único cujo `on.schedule` o
usuário está inscrito/notificado — mas o mesmo guard de `APP_URL` vazio existe
nos 4, então é bem provável que os 4 estivessem morrendo em segundos, todos os
dias, sem produzir nada.

## O que eu fiz agora

Comentei o bloco `schedule:` nos 4 workflows (`alerts.yml`, `fetch-news.yml`,
`monthly-clipping.yml`, `report-automation.yml`). **Nenhum cron dispara mais.**
`workflow_dispatch` continua ativo em todos — dá para rodar manualmente pela
aba Actions do GitHub a qualquer momento, inclusive para testar a correção
antes de reativar o agendamento.

Não toquei no resto do trabalho em andamento no branch (as 45 outras mudanças
não commitadas de outra sessão, incluindo a lógica nova dentro de
`fetch-news.yml` — só a seção `on:` foi alterada).

## Como resolver (e reativar)

1. **Cadastrar os secrets no GitHub**: repo → Settings → Secrets and
   variables → Actions → New repository secret.
   - `APP_URL` = `https://cortex-raoni.vercel.app` (confirmado em `.env.example:5`)
   - `CRON_SECRET` = o mesmo valor que está configurado como env var
     `CRON_SECRET` no projeto Vercel (Settings → Environment Variables). Se
     não existir lá ainda, gerar um valor aleatório longo e configurar nos
     dois lugares (Vercel e GitHub) com o mesmo valor.
2. **Testar na mão antes de reativar o agendamento**: Actions → escolher o
   workflow → "Run workflow" (usa `workflow_dispatch`, que já está ativo).
   Confirmar que cada um termina com sucesso.
3. **Reativar só o necessário, 1x/dia cada**, como pedido — descomentando o
   bloco `schedule:` de cada arquivo (remover os `#` das 2-3 linhas marcadas
   "DESLIGADO em 2026-10-04"):
   - `alerts.yml`: já era 1x/dia, pode voltar como estava (`0 11 * * *`).
   - `fetch-news.yml`: era 4x/dia (a cada 6h). Se a meta é 1x/dia, trocar
     para `0 11 * * *` (ou outro horário) — mas isso muda o comportamento:
     a coleta ficará defasada em até 24h em vez de 6h. Vale decidir com
     calma, não é só reativar.
   - `monthly-clipping.yml` e `report-automation.yml`: já são majoritariamente
     mensais; `report-automation.yml` tem um cron diário extra (04h15 BRT)
     que pode ser removido se 1x/dia (o primeiro, mensal) bastar — depende
     do que esse "atualiza mês corrente" faz e se pode esperar o próximo dia.
4. Depois de confirmar que os 2 secrets resolvem o problema, me avisar que
   quer reativar e eu religo os schedules (1 por workflow, nos horários que
   você escolher).
