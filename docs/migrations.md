# Migrations

Ficam em `supabase/migrations/`. Todas são idempotentes. O dono cola cada uma no SQL Editor do Supabase, porque o conector Supabase do Claude não aponta para o projeto CORTEX. **Nunca edite uma migration já aplicada: crie a próxima.**

**Situação em 08/11/2026:** as migrations **001 a 054 estão aplicadas**; 056, 057 e 058 pendentes, incluindo a 052b nas partes 1 a 3 (`delivered_report_items` com 545 linhas). A **055 está pendente** e é opcional.

| # | O que faz |
|---|---|
| 001–038 | Schema base, clientes, fontes, curadoria, relatório mensal, automação, RLS (035), regras da PRIO e da ANTAQ. Ver o cabeçalho de cada arquivo |
| 039 | Temas mensais por cliente, regras e fontes |
| 040 | Feeds diretos; regras do SindInfor e de Márcio Rea |
| 041 | Veículos citados nos relatórios de setembro; links da PRIO |
| 042 | Consolida fontes duplicadas |
| 043 | `regulatory_agenda_items`; exclusão de "mineração de dados"; desliga 3 fontes vazias |
| 044 | 21 temas da agenda da ANTAQ |
| 045 | `external_key`, `source_label` e chave única na agenda |
| 046 | Pesos das regras da SIMINERAL; `articles.resolve_attempts` |
| 047 | RPC `dashboard_client_counts` |
| 048 | Marcas e temas pedidos |
| 049 | Fontes temáticas da ONS e da CCEE; Zero Hora e Jornal Nacional |
| 050 | Recria a RPC do Painel; exclusões de esporte e entretenimento; marcas |
| 051 | Busca por cliente nos grandes veículos; `client_report_profiles`; `ai_usage_ledger`; `period_cutoff` |
| 052 | RPC `news_hero_counts`; índices; `delivered_report_items` (gabarito) |
| 052b 1–3 | Dados do gabarito, em 3 partes |
| 053 | Feeds oficiais de Valor, Estadão, CNN, Folha, G1, Poder360, InfoMoney e Metrópoles |
| 054 | O Globo; Brasil Mineral; TI Inside, Teletime e Convergência Digital; Diário do Comércio; SindInfor-MG; perfil MG |
| 055 | **Pendente (opcional).** As 147 notícias verificadas de outubro no gabarito (`variant = 'refeito'`) |
| 056 | **Pendente.** "novela" sai das exclusões da 050, porque o ruído agora sai pela seção do link (`src/lib/noise.ts`). Desliga as cópias de InfoMoney e MegaWhat |
| 057 | **Pendente.** 7 buscas por cliente nos veículos que chegaram ao cliente e não tinham fonte (`docs/fontes/faltantes.md`), 26 regras aprendidas (porta-vozes, Magnetita/Hematita com contexto, IP4, Careiro, Carta de Santarém, split payment…), exclusão de PetroRecôncavo e Brava nas regras de setor da PRIO e 27 temas dos destaques de outubro |
| 058 | **Pendente (para o e-mail).** `client_email_recipients` (destinatários por cliente, dado pessoal, só service role) e `clipping_email_sends` (registro de envio, chave cliente + dia + modo, para re-run ser no-op) |
