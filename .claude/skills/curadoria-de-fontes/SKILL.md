---
name: curadoria-de-fontes
description: Achar, testar e cadastrar fonte de notícia (RSS, busca Google News site:) por migration. Use quando um veículo aparecer em docs/fontes/faltantes.md, quando o diagnóstico de fontes apontar QUEBRADA ou MUDA, ou quando o dono pedir fonte nova.
---

# Curadoria de fontes
1. **Achar o feed:** `/feed`, `/rss` e `<link rel="alternate">` na home. A API WordPress (`/wp-json/wp/v2/posts`) é a alternativa. Sem feed, busca do Google News com `site:` e os termos do cliente.
2. **Testar no GitHub Actions** (o container do Claude não alcança os sites): HTTP 200, XML válido, item com data. Feed que responde 200 sem item é MUDO, não serve.
3. **Cadastrar por migration idempotente** (`INSERT ... ON CONFLICT (url)`), no molde de 053/054/057:
   - `is_general` = grande veículo sem vínculo;
   - setorial do cliente vai em `client_sources` com `is_thematic`.
4. **Nunca** o User-Agent de Googlebot, nem contornar paywall ou captcha. Fonte bloqueada vai para `docs/fontes-bloqueadas.md`.
5. **Conferir depois de uma coleta:** `docs/fontes/diagnostico-fontes.sql`.
