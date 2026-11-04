#!/usr/bin/env python3
"""Converte os relatórios refeitos (.md) em .docx mantendo títulos, listas,
tabelas e links clicáveis. Uso: python scripts/md-to-docx.py arquivo.md [...]

Requer python-docx (pip install python-docx). Markdown suportado: o subconjunto
que os relatórios usam (# títulos, - listas, | tabelas |, **negrito**, [texto](url)).
"""
import re
import sys
from pathlib import Path

from docx import Document
from docx.enum.section import WD_ORIENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor

LINK = re.compile(r"\[([^\]]+)\]\((https?://[^)\s]+)\)")
BOLD = re.compile(r"\*\*(.+?)\*\*")


def add_hyperlink(paragraph, text, url):
    part = paragraph.part
    rel_id = part.relate_to(url, "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink", is_external=True)
    link = OxmlElement("w:hyperlink")
    link.set(qn("r:id"), rel_id)
    run = OxmlElement("w:r")
    props = OxmlElement("w:rPr")
    color = OxmlElement("w:color")
    color.set(qn("w:val"), "0F5563")
    underline = OxmlElement("w:u")
    underline.set(qn("w:val"), "single")
    props.append(color)
    props.append(underline)
    run.append(props)
    node = OxmlElement("w:t")
    node.text = text
    node.set(qn("xml:space"), "preserve")
    run.append(node)
    link.append(run)
    paragraph._p.append(link)


def add_inline(paragraph, text):
    """Texto com **negrito** e [links](url)."""
    position = 0
    for match in LINK.finditer(text):
        add_bold_runs(paragraph, text[position:match.start()])
        add_hyperlink(paragraph, match.group(1), match.group(2))
        position = match.end()
    add_bold_runs(paragraph, text[position:])


def add_bold_runs(paragraph, text):
    position = 0
    for match in BOLD.finditer(text):
        if match.start() > position:
            paragraph.add_run(text[position:match.start()])
        paragraph.add_run(match.group(1)).bold = True
        position = match.end()
    if position < len(text):
        paragraph.add_run(text[position:])


def convert(path: Path) -> Path:
    document = Document()
    section = document.sections[0]
    # Paisagem: a tabela de 20 notícias tem 9 colunas.
    section.orientation = WD_ORIENT.LANDSCAPE
    section.page_width, section.page_height = section.page_height, section.page_width
    style = document.styles["Normal"]
    style.font.name = "Calibri"
    style.font.size = Pt(10)

    lines = path.read_text(encoding="utf-8").splitlines()
    table_rows = []

    def flush_table():
        nonlocal table_rows
        if not table_rows:
            return
        header, *body = table_rows
        table = document.add_table(rows=1, cols=len(header))
        table.style = "Light Grid Accent 1"
        for index, cell in enumerate(header):
            paragraph = table.rows[0].cells[index].paragraphs[0]
            run = paragraph.add_run(cell)
            run.bold = True
            run.font.size = Pt(8.5)
        for row in body:
            cells = table.add_row().cells
            for index in range(len(header)):
                paragraph = cells[index].paragraphs[0]
                add_inline(paragraph, row[index] if index < len(row) else "")
                for run in paragraph.runs:
                    run.font.size = Pt(8.5)
        document.add_paragraph()
        table_rows = []

    for raw in lines:
        line = raw.rstrip()
        if line.startswith("|") and line.endswith("|"):
            cells = [cell.strip() for cell in line.strip("|").split("|")]
            if all(re.fullmatch(r":?-{2,}:?", cell) for cell in cells if cell):
                continue
            table_rows.append(cells)
            continue
        flush_table()
        if not line.strip():
            continue
        heading = re.match(r"^(#{1,4})\s+(.*)$", line)
        if heading:
            level = len(heading.group(1))
            paragraph = document.add_heading(level=min(level, 3))
            add_inline(paragraph, heading.group(2))
            for run in paragraph.runs:
                run.font.color.rgb = RGBColor(0x0F, 0x55, 0x63)
            continue
        bullet = re.match(r"^\s*[-*]\s+(.*)$", line)
        numbered = re.match(r"^\s*\d+[.)]\s+(.*)$", line)
        if bullet or numbered:
            paragraph = document.add_paragraph(style="List Bullet" if bullet else "List Number")
            add_inline(paragraph, (bullet or numbered).group(1))
            continue
        if re.fullmatch(r"-{3,}", line.strip()):
            continue
        add_inline(document.add_paragraph(), line)
    flush_table()
    output = path.with_suffix(".docx")
    document.save(output)
    return output


if __name__ == "__main__":
    for name in sys.argv[1:]:
        print(convert(Path(name)))
