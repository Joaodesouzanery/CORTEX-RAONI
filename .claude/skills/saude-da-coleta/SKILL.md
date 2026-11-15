---
name: saude-da-coleta
description: Diagnóstico da coleta de notícias e das fontes. Use quando o dono disser que "pararam de vir notícias", quando o Painel ou Notícias estiver vazio, ao mexer em fontes, ou quando o vigia (watchdog.yml) apontar "coleta" ou "fontes".
---

# Saúde da coleta
**Ordem de diagnóstico:** a primeira resposta que falhar é a causa.

1. **A coleta rodou?** Veja em Actions o último `Fetch news`. Se falhou em segundos, a causa está fora do código: siga a skill `saude-do-deploy`.
2. **Gravou no banco?** No SQL Editor:
   `SELECT started_at, status, inserted_count, error_count, total_sources FROM fetch_runs ORDER BY started_at DESC LIMIT 5;`
   - Idade acima de 14 h é coleta parada.
   - `status = 'erro'` é coleta quebrada.
3. **Quais fontes estão falhando?** Cole `docs/fontes/diagnostico-fontes.sql`. O veredito sai por fonte: QUEBRADA, MUDA, SEM RELEVÂNCIA, GOOGLE PRESO ou OK.
4. **A notícia entrou mas não aparece?** Ela precisa de etiqueta para aparecer no Painel:
   `SELECT monitoring_status, count(*) FROM article_client_tags t JOIN articles a ON a.id = t.article_id WHERE a.fetched_at > now() - interval '1 day' GROUP BY 1;`
   - Muito `revisao`: aparece na aba Setor e no Painel.
   - Nenhuma etiqueta: regra ou tema não casou. Confira o tema em `client_report_topic_templates`.
5. **O Google News está preso?** Conte os links pendentes:
   `SELECT count(*) FROM articles WHERE url LIKE 'https://news.google.com/%' AND resolved_url IS NULL AND resolve_attempts < 3;`

**Regras:**
- Fonte que responde 200 sem item não é sucesso (`last_success_at` só avança com item).
- Queda de fonte não é queda de notícia: a tela diz por quê.
