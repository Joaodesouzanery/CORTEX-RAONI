# Objetivo final
Ao buscar notícias, cada cliente recebe automaticamente as matérias que sua curadoria escolheria à mão. O sistema entrega temas, destaques e links; o relatório sai pronto, faltando só o design no Claude Design.

Serviços distintos: portal interno de notícias, clipping, relatórios e boletins. Relatórios e boletins são pagos e contratados por contato.

## Temas-alvo
A lista viva está em `client_report_topic_templates` (migration 039). Temas por cliente definidos em 31/10/2026:
- **CCEE:** mercado livre e baixa tensão; liquidez e comercializadoras; gás e térmicas; Regras de Comercialização 2027; PLD e modelos; curtailment; reserva de capacidade.
- **PRIO:** imposto de exportação; Brent; produção e 200 mil bpd; Wahoo; Peregrino; campos maduros; reforma tributária; política industrial.
- **SINDINFOR:** Redata e gás; Paracatu; energia e IA; licenciamento em MG; ICMS; backbone; regulação de IA e dados; nuvem soberana; cibersegurança.
- **SIMINERAL:** PNMCE; CIMCE; regulamentação; agregação de valor; pesquisa mineral; comunidades; ANM; rastreabilidade; FGAM; PD&I; terras raras; competitividade.
- **DAQ:** canal de Santos; Tecon 10 e armadores; concessões e hidrovias (Tocantins, Paraguai, Madeira, Tapajós, Arco Norte); PNL 2050; integração; saturação; TUPs; dragagem; seguros.
- **ONS:** reserva de capacidade; LRCAP; baterias; GD; curtailment; flexibilidade; data centers; térmicas e El Niño; confiabilidade.

## Destaques
Matéria em que o cliente ou seu dirigente tem voz. O sistema sugere; uma pessoa confirma. Atenção a grafias alternativas ("Sindifor") e a dirigentes citados sem o nome do órgão.

## Como medir
Skill `calibracao-contra-gabarito`. Só contam links verificados. Links dos relatórios de setembro de DAQ e ONS tiveram muitos 404 (16/20 e 12/21, em 31/10/2026) e não valem como gabarito até serem conferidos.
