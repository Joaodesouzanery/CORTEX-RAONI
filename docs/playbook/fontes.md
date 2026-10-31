# Fontes
Ordem de preferência: **feed oficial** → **consulta temática no Google News** → **scraping testado**.

Regras: testar antes de cadastrar; `safeFetch`; não contornar bloqueio, login ou paywall; nunca usar User-Agent de Googlebot; fonte fora do ar é falha visível; `access_mode` honesto. Respeitar robots.txt e termos de uso do site.

Dependência: a maior parte do catálogo histórico passa pelo Google News. Migrations 040 e 041 adicionam feeds diretos. Google News traz só metadados e o link real é resolvido depois.

Migrations: entregues como SQL; o usuário cola no Supabase.
