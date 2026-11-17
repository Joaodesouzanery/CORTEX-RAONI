---
name: agenda-regulatoria
description: Conector de pauta e decisões de agência reguladora (ANEEL, ANP, ANM, ANATEL, ANPD, ANTAQ) para a agenda regulatória. Use ao criar ou consertar conector em src/lib/agenda/ ou ao ligar agenda a cliente.
---

# Agenda regulatória
- **Desenho e ordem:** `docs/agenda-regulatoria.md`. **Molde:** `src/lib/agenda/antaq.ts`.
- **Busca:** sempre `safeFetch`, conferindo o `res.status`. Página fora do ar é falha visível, não "sem itens".
- **Checagem de formato** (mínimo de itens esperado): layout novo da agência falha, não grava zero.
- **Gravação:** `regulatory_agenda_items` com o link oficial e os `client_names`, de forma idempotente.
- **Teste:** com HTML de amostra em `src/lib/agenda/__fixtures__`.
- **Só fonte pública:** nada de captcha, login ou contorno.
