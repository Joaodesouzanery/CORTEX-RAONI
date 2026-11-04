# Fontes bloqueadas ou com assinatura

Lista para decisão comercial (assinatura, parceria ou aceitar só título e link).
O Cortex **não contorna** bloqueio: não usa User-Agent de robô do Google, não
resolve captcha e não usa login de terceiros sem acordo. O que está abaixo entra,
quando entra, só com **título e link pelo Google News**, marcado como "só título"
no Clipping e como "match fraco" no relatório.

Atualizado em 04/11/2026. A lista viva está na tela Saúde (fontes com erro na
última coleta) e em `sources.last_fetch_error`.

## Bloqueiam acesso automatizado

| Fonte | Situação | Efeito hoje | Opção |
|---|---|---|---|
| Brasil Energia | HTTP 403 a qualquer acesso automatizado; não aparece no Google News | **Sem cobertura.** 16 manchetes do clipping de outubro da ONS ficaram de fora | Assinatura com acesso a newsletter/feed ou envio do clipping pelo fornecedor |
| ANTAQ, Painel Aquarela | Bloqueia robô | A agenda usa o PDF público do boletim | Nenhuma ação necessária |

## Paywall (texto integral exige assinatura)

| Fonte | Efeito hoje | Opção |
|---|---|---|
| Valor Econômico | Título e link pelo Google News e pela busca por cliente (051) | Assinatura corporativa, se quiser o texto para análise de tom |
| Estadão / Broadcast | Idem | Idem. Broadcast Energia é o serviço com mais matérias do setor |
| Folha de S.Paulo | Idem | Idem |
| O Globo | Idem | Idem |
| Eixos (parte do conteúdo) | Idem | Assinatura Eixos, muito citada nos relatórios de energia e petróleo |
| MegaWhat (parte do conteúdo) | Idem | Assinatura, citada nos relatórios da CCEE e da ONS |

## Feeds oficiais que funcionam (migration 053, testados em 04/11/2026)

Esses veículos publicam um feed RSS público com título, resumo e link. Isso é
**automação legítima**: é o que o próprio veículo distribui. Não entrega o texto
completo das matérias fechadas.

| Veículo | Feed | Itens por leitura |
|---|---|---|
| Valor Econômico | valor.globo.com/rss/valor | 100 |
| Estadão | estadao.com.br/arc/outboundfeeds/rss | 100 |
| CNN Brasil | cnnbrasil.com.br/feed | 60 |
| Folha (Mercado e Poder) | feeds.folha.uol.com.br | 100 cada |
| G1 (Economia e Tecnologia) | g1.globo.com/rss | 100 cada |
| Poder360, InfoMoney, Metrópoles | /feed | 10 a 20 |
| Eixos, MegaWhat | /feed (já cadastrados) | 10 a 20 |

Não funcionam: **O Globo** (RSS responde 400; entra pela busca do Google News da
051) e **Brasil Energia** (403).

## Por que não "raspar" o texto completo

Ler a matéria atrás do paywall exige contornar a barreira (login automatizado,
cookies de assinante, robô fingindo ser buscador). Isso fere os termos de uso,
expõe a consultoria a ação por direito autoral e está vetado no repositório. Os
caminhos legítimos para o texto integral:

1. **Assinatura corporativa com API ou licença de clipping.** Estadão/Broadcast e
   Valor (Valor PRO) vendem acesso para empresas; peça a licença de uso para
   monitoramento.
2. **Clipping licenciado.** Um fornecedor que já paga os direitos e entrega o texto.
   O Cortex importa o PDF diário (a importação já existe).
3. **Só título e link** (como hoje). Para clipping e relatório basta: o link é
   obrigatório e o texto não.

## Para o sócio decidir

1. **Brasil Energia** é a única lacuna sem nenhuma cobertura. Recomendo uma assinatura com feed ou newsletter.
2. Para os paywalls, o título e o link exato bastam para o clipping e para o relatório (link é obrigatório; texto não). A assinatura só melhora a análise de tom e de porta-voz.
3. Nenhuma assinatura deve ser usada por robô sem que os termos de uso permitam.
