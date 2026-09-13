/**
 * Célula de CSV segura contra injeção de fórmula.
 *
 * O conteúdo destes CSVs vem de terceiros — títulos de matéria, nomes de
 * veículo, razões editoriais escritas por um modelo. Excel, LibreOffice e
 * Google Sheets interpretam uma célula que comece com `=`, `+`, `-` ou `@`
 * como fórmula, então um título como `=HYPERLINK("http://evil","clique")` ou
 * `=cmd|'/c calc'!A0` executa na máquina do analista que abre o arquivo.
 *
 * Escapar aspas (o que o código fazia) resolve o CSV; não resolve isso. O
 * prefixo `'` força a planilha a tratar a célula como texto.
 *
 * Efeito colateral aceito: um título que genuinamente comece com "-" ganha um
 * apóstrofo à esquerda quando aberto numa planilha.
 */
export function csvCell(value: unknown): string {
  const text = String(value ?? '')
  const neutralized = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return `"${neutralized.replace(/"/g, '""')}"`
}
