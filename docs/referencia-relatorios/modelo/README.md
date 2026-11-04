# Relatórios Mensais de Comunicação Estratégica e Inteligência Reputacional

Repositório com todos os relatórios mensais (jun–out/2026) produzidos para os clientes recorrentes, os materiais-fonte recebidos, as imagens de capa, as logos e os playbooks de regras.

> **Importante:** mantenha todos os arquivos na **mesma pasta raiz** (sem reorganizar em subpastas). Os relatórios carregam imagens, logos e scripts por caminho relativo — se mover um arquivo, a capa ou a logo deixa de aparecer.

---

## 1. Como abrir e exportar

- Abra qualquer `*.dc.html` direto no navegador (Chrome recomendado). É preciso estar online para carregar as fontes (IBM Plex).
- **Para gerar PDF:** abra o relatório → `Ctrl/Cmd + P` → Destino “Salvar como PDF” → Margens “Nenhuma” → marque “Gráficos de plano de fundo”. O formato A4, a paginação e o rodapé numerado já são aplicados automaticamente.
- Arquivos de suporte obrigatórios na raiz: `support.js`, `doc-page.js`, `image-slot.js`.

---

## 2. Estrutura do repositório

| Tipo | Arquivos | Para que serve |
|---|---|---|
| **Relatórios (Pages)** | `Relatorio <CLIENTE> <Mês> 2026.dc.html` | Relatório final de cada cliente/mês |
| **Boletins** | `Boletim SindInfor Associados <Mês> 2026.dc.html` | Versão reduzida do SindInfor para associados (só notícias) |
| **Prospecção** | `SAUZ Analise Setorial Mercado Livre.dc.html` | Documento SAUZ de prospecção (abertura do mercado livre / baixa tensão) |
| **Scripts** | `support.js`, `doc-page.js`, `image-slot.js` | Motor de renderização, paginação A4 e rodapé |
| **Capas** | `cover_*.jpg` | Fotos de capa (Adobe Stock licenciadas), uma por cliente/mês |
| **Logos** | `sauz-logo*.png`, `crt-logo*.png`, `vx-logo*.png`, `sindinfor-logo*.png` | Versões branca (capa) e escura (encerramento) |
| **Playbooks** | `Playbook_Completo_Relatorios.docx`, `Playbook_Relatorios_Comunicacao.docx` | Regras gerais e por cliente — **ler antes de cada ciclo** |
| **Fontes de conteúdo** | `uploads/` | Pacotes `.md`, `.docx` e `.pdf` enviados para cada relatório, prints e PDFs de referência |
| **Apoio (texto bruto)** | `_Relatorio_*_Setembro2026.txt`, `_links.txt` | Extrações de texto/links usadas na montagem de setembro |

Convenção de nomes das capas: `cover_<cliente>_<mês>.jpg` (ex.: `cover_ccee_out.jpg`, `cover_daq_out2.jpg`).

---

## 3. Clientes, marca responsável e particularidades

| Cliente | Assinatura | Logo usada | Observações fixas |
|---|---|---|---|
| **ONS** | **CRT** (sempre) | `crt-logo-white.png` / `crt-logo.png` | Tabela de atividades com números informados mês a mês; links + porta-voz nas evidências |
| **CCEE** | SAUZ | `sauz-logo*.png` | **Sem** dados de atendimento/reuniões; guardrail CCEE (liquida) × ONS (despacha) × ANEEL (regula) × MME (política) |
| **PRIO** | **VX** (out/26 em diante) | `vx-logo-white.png` / `vx-logo-dark.png` | Nome correto: **PRIO S.A.** (nunca PetroRecôncavo); sem dados de atendimento; foco em campos maduros offshore |
| **SindInfor** | SAUZ (pequena) | `sindinfor-logo*.png` no centro + SAUZ discreta | Formato **boletim de notícias** — sem estratégia/recomendações; local **Brasília/DF**; duas versões: Empresa e Associados |
| **SIMINERAL** | SAUZ | `sauz-logo*.png` | “Visão geral com inserções sobre a SIMINERAL”; nunca expor baixo volume de menções |
| **DAQ (DNIT Aquaviária)** | SAUZ | `sauz-logo*.png` | DNIT/DAQ **executa** (dragagem, sinalização, IP4); MPor = concessões; ANTAQ = regulação; não criticar o DNIT; obras sempre necessárias, condicionadas a licença/acordo |
| **ANTAQ** | CORTEX | — | Relatório de agosto/26 |

---

## 4. Regras gerais (valem para todos)

1. **Máximo de 20 páginas** por relatório.
2. **Tom sempre positivo / de crescimento** — nada de “não houve”, “ausência de”, “falhou”. Riscos viram “pontos de atenção”.
3. **Postura de assessoria, nunca de comando**: a consultoria *auxilia, assessora, subsidia, apoia*; a coordenação é sempre da equipe do cliente.
4. **Sem porcentagens** nos cenários prospectivos (usar “Apoio possível”).
5. **Sem coluna “Tom”** nas tabelas de síntese de temas (fica só na Base de Evidências).
6. **Links:** só entram quando a URL corresponde exatamente à matéria. Link que leva só para a página inicial do veículo fica fora.
7. **Nunca inventar** número, nome, data, citação ou fonte.
8. **Capa nova a cada mês** — não repetir imagem de meses anteriores.
9. Notas internas de processo (ex.: “links não encontrados”) nunca aparecem no relatório final.

---

## 5. Estrutura padrão de um relatório

Capa → Nota de método / destaque do mês → Sumário → 01 Sumário Executivo (+ Top Insights) → 02 Temas Estratégicos → 03 Leitura Reputacional → 04 Análise Temática (com “Leitura de contexto”) → 05 Pontos de Atenção → 06 Oportunidades → 07 Recomendações → 08 Cenários → 09 Demonstração dos Serviços → 10 Base Qualificada de Evidências → Encerramento.

SindInfor e Boletim Associados seguem o formato reduzido: Capa → Sobre o boletim → Resumo → Notícias por tema (com fontes/links) → Base de notícias.

---

## 6. Inventário por mês

| Mês | Relatórios |
|---|---|
| Junho/26 | ONS, DAQ, SindInfor |
| Julho/26 | ONS, CCEE, DAQ, PRIO, SIMINERAL, SindInfor |
| Agosto/26 | ONS, CCEE, DAQ, PRIO, SIMINERAL, SindInfor, ANTAQ |
| Setembro/26 | ONS, CCEE, DAQ, PRIO, SIMINERAL, SindInfor (+ Completo) e Boletim Associados |
| Outubro/26 | CCEE, PRIO, DAQ, SindInfor e Boletim Associados — **pendentes: ONS e SIMINERAL** |

Extra: `SAUZ Analise Setorial Mercado Livre.dc.html` (prospecção).

---

## 7. Fluxo para um novo mês

1. Colocar o pacote de conteúdo (`.md` / `.docx`) em `uploads/`.
2. Conferir no pacote: nome da empresa, marca responsável, datas, links (devem levar à matéria).
3. Duplicar o relatório do mês anterior do mesmo cliente e substituir o conteúdo.
4. Licenciar uma capa nova e salvar como `cover_<cliente>_<mês>.jpg`.
5. Aplicar as regras das seções 3 e 4 e revisar contra o Playbook.
6. Exportar o PDF (seção 1).
