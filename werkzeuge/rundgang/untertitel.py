"""Writes the captions of medien/kapitel.json into README.md, between the two markers."""
import json
import re
from pathlib import Path

kapitel = json.loads(Path('medien/kapitel.json').read_text(encoding='utf-8'))['kapitel']
zeilen = []
for sekunde, text in kapitel:
    minute, rest = divmod(int(sekunde), 60)
    zeilen.append(f"- {minute}:{rest:02d} {text}")
readme = Path('README.md')
neu = re.sub(r'<!-- untertitel -->.*?<!-- /untertitel -->',
             lambda m: '<!-- untertitel -->\n\n' + '\n'.join(zeilen) + '\n\n<!-- /untertitel -->',
             readme.read_text(encoding='utf-8'), flags=re.S)
readme.write_text(neu, encoding='utf-8')
