# Variáveis de ambiente (sem valores)

Os valores nunca vão para o repositório. Na conta nova, copie-os do painel atual da Vercel e dos secrets do GitHub, ou gere novos.

## Vercel (Settings → Environment Variables)

| Variável | Obrigatória | Para quê |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | sim | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sim | Chave anon (a 035 fechou o acesso direto) |
| `SUPABASE_SERVICE_ROLE_KEY` | sim | As rotas rodam como service role. **Segredo** |
| `CRON_SECRET` | sim | Protege `/api/internal/*` e `/api/alerts/check` (Bearer) |
| `APP_URL` | sim | URL pública, usada pelo worker para continuar lotes |
| `ANTHROPIC_MONTHLY_BUDGET_USD` | antes da chave | Teto mensal da IA (sugestão: `40`) |
| `ANTHROPIC_DAILY_CALL_LIMIT` | antes da chave | Teto diário de chamadas (sugestão: `300`) |
| `ANTHROPIC_API_KEY` | por último | Triagem, verificação e geração. Sem ela, o pipeline para e mostra o aviso |
| `RESEND_API_KEY` | para e-mail | Envio de alertas e resumos |
| `ALERTS_EMAIL_FROM` | para e-mail | Remetente de domínio verificado, por exemplo `CORTEX <boletim@dominio>` |
| `ALERTS_EMAIL_TO` | para e-mail | Destinatários dos alertas, separados por vírgula |
| `GITHUB_ACTIONS_TOKEN` | opcional | Token restrito ao repositório (Actions: write) para os botões "Fechar mês" e "Regenerar" |
| `GITHUB_REPOSITORY` | opcional | `Joaodesouzanery/CORTEX-RAONI` |
| `GITHUB_WORKFLOW_REF` | opcional | Branch dos workflows |
| `PEXELS_API_KEY` | futuro | Banco de imagens (nome reservado, ainda sem uso) |
| `UNSPLASH_ACCESS_KEY` | futuro | Banco de imagens (nome reservado, ainda sem uso) |

## GitHub (Settings → Secrets and variables → Actions)

| Secret | Para quê |
|---|---|
| `APP_URL` | Os workflows chamam a aplicação (coleta, links, agenda, saúde) |
| `CRON_SECRET` | O mesmo valor da Vercel |

## Ordem para ligar a IA
1. Na Anthropic, criar a chave e definir um limite mensal de **US$ 50** no console.
2. Na Vercel, definir `ANTHROPIC_MONTHLY_BUDGET_USD` e `ANTHROPIC_DAILY_CALL_LIMIT`.
3. Só então definir `ANTHROPIC_API_KEY` e fazer um novo deploy.

O orçamento está em `docs/orcamento.md`.
