# Modelo do relatório mensal
Extraído dos relatórios de setembro/2026. Texto de 2.300 a 3.700 palavras, antes do design.

1. **Sumário executivo**
2. **Temas estratégicos do mês:** panorama quantitativo e quadro-síntese (tema, relevância, sinal do mês)
3. **Leitura reputacional do ambiente**
4. **Análise temática aprofundada:** uma subseção por tema relevante
5. **Riscos reputacionais prioritários:** probabilidade e impacto
6. **Oportunidades de posicionamento**
7. **Recomendações executivas:** imediata, curto e médio prazo
8. **Cenários prospectivos**
9. **Demonstração dos serviços prestados**
10. **Base qualificada de evidências:** título clicável, veículo, data; indica quando a voz é do cliente

O código tem nove seções geradas (`generateReportSection`); a base de evidências é a décima, montada a partir dos dados, não pelo modelo.

## Regras
- Abre com nota de método e o guardrail institucional do cliente (ex.: CCEE não despacha; isso é do ONS).
- Todo número declara janela, denominador, truncamento e composição (`metrica-honesta`).
- Toda afirmação tem evidência real com link verificado. Link quebrado bloqueia.
- Saída: texto estruturado para o Claude Design, com marca escolhida (SAUZ, CRT ou Grupo Nery).
