# Relatórios de outubro de 2026, refeitos para conferência externa

Cada cliente tem 20 notícias de outubro de 2026 com link exato. Cada link foi aberto e teve título, veículo e data conferidos. Os arquivos estão em `.md` e `.docx` nesta pasta. Matéria atrás de paywall aparece como "só título"; nada foi contornado. O que não pôde ser confirmado ficou na última seção de cada arquivo.

| Cliente | Marca | Cliente / Setor | Links errados no relatório entregue | Destaque |
|---|---|---|---|---|
| PRIO | VX | 15 / 5 | 9 de 10 (fora do mês, título que não existe na página, portal que nem cita a PRIO) | O fato do mês faltou: a PRIO arrematou os blocos Magnetita e Hematita no pré-sal em 07/10, com 8 matérias. A CNN de 05/10 ("Prio eleva vendas no 3º tri") é a provável matéria perdida |
| CCEE | SAUZ | 18 / 2 | 6 de 10 (4 fora de outubro e 2 links `?p=` da Agência iNFRA que abrem outra matéria) | Leilão de gás da União na plataforma da CCEE, com 9 matérias. Porta-vozes: Gerusa Côrtes e Ricardo Simabuku |
| SINDINFOR | SAUZ | 2 / 18 | 23 de 24 (13 fora do mês, vários 404, links que não abrem) | **Confirmar a entidade:** sindinfor.org.br é de Minas Gerais; a entidade de TI do DF na imprensa é o SINFOR/DF. Nenhuma matéria de outubro cita a entidade |
| ONS | CRT | 19 / 1 | — (não há relatório de outubro entregue no zip) | 13 das 20 estavam no clipping do fornecedor. O clipping perdeu 3 da janela dele, incluindo a única crítica ao ONS no mês (Poder360, cortes de geração +52%) |
| SIMINERAL | SAUZ | 8 / 12 | — (o rascunho do outro chat estava em Minas Gerais e com o mês errado) | Carta Santarém (relatório ESG, 20/10) e Panorama da Mineração do 1º semestre. A Brasil Mineral (página do Pará) é a melhor fonte |
| DAQ | SAUZ | 11 / 9 | 9 de 9 (fora do mês ou do tema, 8 sem data) | Dragagens no Madeira, Paraguai e Manaus–Careiro. Ponto de atenção: "dragagem sem licença", A Crítica, 31/10 |
| ANTAQ | CORTEX | 15 / 5 | — (não há relatório de outubro entregue) | Edital do MUC04 em Fortaleza, decisão do STF sobre o SSE, cestas dos Tecons |

## O que explica as reclamações dos clientes

1. **"Poucas matérias":** os relatórios entregues não tinham coleta própria de outubro. Completaram a lista com matérias de outros meses e links que não correspondem ao título. Com coleta e verificação, todos os clientes chegam a 20.
2. **"Portais desconhecidos":** os grandes veículos estavam ausentes. Na PRIO, a refeita tem 11 de 20 em grandes veículos (Valor, eixos, CNN, VEJA, Estadão, Exame).
3. **"Matéria da CNN perdida":** a CNN de 05/10 sobre a PRIO foi achada. O feed oficial da CNN entra pela migration 053.

## O que o Cortex passa a fazer (ou precisa fazer)

- **Já existe:** a busca por cliente nos grandes veículos (051) e os feeds oficiais de Valor, Estadão, CNN, Folha, G1, Poder360, InfoMoney e Metrópoles (053). As regras de setor também exigem o termo no título ou no resumo.
- **A fazer:**
  - Recusar item com data fora do mês ou sem data.
  - Gravar a URL final depois do redirecionamento e conferir o título da página. Os links `?p=` da Agência iNFRA e do InfoMoney abrem outra matéria.
  - Recusar link de seção ou de página inicial (o validador do gerador já aponta).
  - Novas fontes: Brasil Mineral (Pará), CanalEnergia, Convergência Digital, TI Inside e Teletime (estas três pela API pública do WordPress), Movimento Econômico e Portos e Navios.
  - Novos termos por cliente:
    - PRIO: Magnetita, Hematita, Prio Forte, Peregrino, Wahoo, Frade;
    - CCEE: Gerusa Côrtes, Ricardo Simabuku;
    - ANTAQ: Frederico Dias, MUC04, SSE.
  - Exclusões da PRIO: PetroRecôncavo/RECV3 e Brava/BRAV3.
  - Guardar a UF e a entidade exata de cada cliente (o caso SINDINFOR).

## Pacote para o Claude Design

Envie o `.docx` (ou `.md`) de cada cliente, junto com as regras de `docs/referencia-relatorios/modelo/README.md`:
- máximo de 20 páginas;
- tom positivo, com riscos tratados como pontos de atenção;
- verbos auxilia, assessora, subsidia e apoia;
- sem porcentagens nos cenários;
- sem coluna Tom na síntese;
- link só da matéria exata;
- capa nova a cada mês.

As colunas Tom e Porta-voz foram preenchidas a partir do título e do lead. Elas precisam de revisão humana antes do envio ao cliente.
