#!/usr/bin/env python3
"""Extrai os links clicáveis dos PDFs finais de relatório para JSON.
Uso: python scripts/extract-pdf-links.py <pasta-com-pdfs> > docs/links/pdf-links.json
Requer pypdf. O PDF é dado: só lemos anotações /URI."""
import json
import re
import sys
from pathlib import Path

from pypdf import PdfReader

CLIENTS = [("SindInfor", "SINDINFOR"), ("CCEE", "CCEE"), ("PRIO", "PRIO"), ("SIMINERAL", "SIMINERAL"), ("DAQ", "DAQ"), ("ONS", "ONS"), ("ANTAQ", "ANTAQ")]
out = []
for pdf in sorted(Path(sys.argv[1]).glob("*.pdf")):
    client = next((code for key, code in CLIENTS if key.lower() in pdf.name.lower()), None)
    for page in PdfReader(str(pdf)).pages:
        for annot in page.get("/Annots") or []:
            obj = annot.get_object()
            action = obj.get("/A")
            uri = action.get_object().get("/URI") if action else None
            if uri and re.match(r"https?://", str(uri)):
                out.append({"client": client, "file": pdf.name, "url": str(uri)})
print(json.dumps(out, ensure_ascii=False, indent=1))
