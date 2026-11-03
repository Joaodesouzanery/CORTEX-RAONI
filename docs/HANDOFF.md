# Handoff do Cortex
Ponto de partida para qualquer chat ou pessoa. Atualizado em 02/11/2026. Leia também `CLAUDE.md` e `docs/playbook/README.md`.

## Como trabalhar com o dono
- Responder em português, de forma direta.
- Tudo vai para o GitHub ao fim de cada etapa.
- Migrations e SQL: entregar o texto **completo**, pronto para colar no SQL Editor do Supabase. Nunca um trecho. O dono aplica.
- O SQL Editor exibe no máximo 100 linhas: exportações usam `limit` e `offset` explícitos.
- Só conectar a Anthropic quando todo o resto estiver pronto.

## Produto
Cortex: monitoramento de imprensa. Serviços: notícias, relatórios (terceiros com link), clipping (íntegra de matérias de autoria própria), boletim e agenda regulatória. Relatórios e boletins são pagos, contratados por neryadministrativo@gmail.com. SAUZ, CRT e Grupo Nery são marcas de entregável.

## Estado
Branch de trabalho: `claude/news-panel-automation-ee1d09`; base `claude/busy-knuth-aynxlz`.

Pronto:
- Temas por cliente no Painel, pacote para Claude, destaques.
- Coleta 3x/dia em `fetch-news.yml`.
- Telas `/bulletins` e `/agenda`.
- Playbook, skills e agents em `.claude/`.

Migrations: até 043 aplicadas pelo dono; 044 entregue; 046 aplicada; **047 pendente** (contagens do Painel em uma consulta).

Agenda: só ANTAQ por decisão do dono. Conector automático em `src/lib/agenda/antaq.ts`: acha o boletim mais recente na página oficial, lê o PDF e grava; roda no `fetch-news.yml`; sem boletim novo é no-op. Painel Aquarela não é usado: bloqueia acesso automatizado.

## Pendências
0. Evidência fraca (sem texto integral) já marcada no Painel e no pacote; falta levar a marca ao relatório e ao PDF.
1. Teste SIMINERAL: 291 matérias recebidas (173 confirmadas, 89 mencionam Pará, 224 links Google News, 6 citam o cliente); ajustar regras (excesso de mineração fora do Pará) e reclassificar; redigir relatório e 2-3 matérias neste chat, com aprovação humana.
2. Resolver links `news.google.com` para a URL real antes de usar como evidência (53 de 100 na amostra).
3. Conferir com a consultoria os links dos relatórios DAQ e ONS de setembro (muitos 404).
4. Conferir se InfoMoney e Diário do Transporte voltaram e se a coleta das 12h e 18h roda.
5. Bancos de imagem: Pexels, Unsplash, Agência Brasil, Wikimedia; conferir termos e integrar.
6. Conteúdo próprio e clipping autoral: tabelas, fluxo e aprovação ainda não existem.
7. Login e acesso por serviço e cliente, antes de vender e antes da chave da Anthropic.
8. Interface inspirada no modelo enviado: ainda não aplicada.
9. Trocar `claude-sonnet-4-6` por `claude-sonnet-5-5` ao conectar a Anthropic.

## Falta conectar (repetir ao dono em toda resposta)
- Colar a migration 047 (sem ela o Painel não carrega as contagens).
- Rodar `fetch-news` manual com `reclassify_archive` e período 2026-10.
- Conferir em Actions se `fetch-news` roda 3x/dia e o passo da agenda.
- Chaves `PEXELS_API_KEY` e `UNSPLASH_ACCESS_KEY`.
- Login, antes da `ANTHROPIC_API_KEY`.
- `RESEND_API_KEY` se quiser alertas e envio por e-mail.

## Variáveis
Nunca coloque valores neste arquivo.

**Vercel:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`.
Opcionais: `RESEND_API_KEY`, `ALERTS_EMAIL_FROM`, `ALERTS_EMAIL_TO` (alertas). Depois: `ANTHROPIC_API_KEY`; `PEXELS_API_KEY`, `UNSPLASH_ACCESS_KEY` (nomes reservados, ainda sem uso no código).

**GitHub Actions:** `APP_URL`, `CRON_SECRET` (mesmo valor da Vercel).

## Conectores de outro chat
O projeto CORTEX não aparecia no conector Supabase usado até aqui; sem ele, consulte o banco pelo dono, com SQL completo.
