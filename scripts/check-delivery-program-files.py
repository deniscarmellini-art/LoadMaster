"""Read-only QA for files produced by frontend/scripts/delivery-program.test.mjs."""
from pathlib import Path
import re
import json
import sys
import xml.etree.ElementTree as ET
import zipfile
import pymupdf

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('.verification/delivery-program')
ddt_source=Path('backend/src/services/ddtPreviewPdf.ts').read_text(encoding='utf-8')
issuer=json.loads(re.search(r'export const ddtIssuer = (\{.*?\}) as const;',ddt_source).group(1))
for filename in ['programma-una-pagina.pdf', 'programma-multipagina.pdf']:
    doc = pymupdf.open(root / filename)
    assert len(doc) == 1 if filename == 'programma-una-pagina.pdf' else len(doc) > 2
    all_text = ''
    for index, page in enumerate(doc, 1):
        text = page.get_text()
        all_text += text
        assert 'PROGRAMMA CONSEGNE' in text
        assert 'ESSEPI S.r.l.' in text and 'Vettore TEST' in text
        normalized=' '.join(text.split())
        for value in issuer.values():
            assert ' '.join(value.split()) in normalized, value
        assert 'Modalità di trasporto' not in normalized
        assert 'Terzi per Essepi' not in normalized
        assert 'non sostituisce il DDT' in text
        assert f'Pagina {index} di {len(doc)}' in text
        number=page.search_for(f'Pagina {index} di {len(doc)}')[0]
        assert 124 < number.y0 < number.y1 < 153, number
        bars=[drawing for drawing in page.get_drawings() if abs(drawing['rect'].y0-124)<.2 and abs(drawing['rect'].y1-153)<.2]
        # jsPDF writes RGB components rounded to two decimal places.
        assert any(all(abs(value-expected/255)<.006 for value,expected in zip(bar['fill'],[36,129,63])) for bar in bars if bar['fill'])
        images=page.get_image_info()
        assert any(abs(image['bbox'][0]-34)<.2 and abs(image['bbox'][1]-35)<.2 and abs(image['bbox'][2]-119)<.2 and abs(image['bbox'][3]-120)<.2 for image in images)
        assert 'Commessa' in text and 'Data' in text and 'prevista' in text
        assert abs(page.rect.width - 841.89) < 1 and abs(page.rect.height - 595.28) < 1
        footer = page.search_for('Documento di pianificazione')[0]
        for word in page.get_text('words'):
            x0,y0,x1,y1,*_ = word
            assert x0 >= 32 and x1 <= page.rect.width - 32, (filename,index,word)
            if 140 < y0 < footer.y0 - 1:
                assert y1 <= page.rect.height - 17*72/25.4 + 2, (filename,index,word)
        page.get_pixmap(matrix=pymupdf.Matrix(1.2,1.2)).save(root / f'{Path(filename).stem}-{index}.png')
    if filename == 'programma-multipagina.pdf':
        assert 'RIFERIMENTO-ORDINE-MOLTO-LUNGO-2026-0123456789-ABCDEFGHIJKLMN' in re.sub(r'\s+','',all_text)
        for index in range(35):
            assert len(re.findall(rf'FINE-{index}(?!\d)',all_text)) == 1, index
        for index in range(180):
            assert all_text.count(f'ISTRUZIONE-{index:03}') == 1, index
        assert all_text.count('FINE-NOTA-LUNGA') == 1
    else:
        assert 'REF-2026-0000000123456' in all_text, 'Reference should stay on one line when it fits'
        assert 'INDIRIZZO MANCANTE' in all_text
        spans=[span for block in doc[0].get_text('dict')['blocks'] if 'lines' in block for line in block['lines'] for span in line['spans'] if 'INDIRIZZO' in span['text'] or 'MANCANTE' in span['text']]
        assert spans and all(span['color']==0x9c271c for span in spans), spans
    print(f'{filename}: {len(doc)} pagine; intestazioni, piè pagina, limiti e testo completo OK')

ns = {'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(root / 'programma-consegne.xlsx') as book:
    sheet=ET.fromstring(book.read('xl/worksheets/sheet1.xml'))
    styles=ET.fromstring(book.read('xl/styles.xml'))
    formats=styles.find('s:cellXfs',ns)
    for cell in sheet.findall('.//s:c',ns):
        alignment=formats[int(cell.attrib['s'])].find('s:alignment',ns)
        assert alignment is not None and alignment.attrib.get('wrapText') == '1'
    assert sheet.find('s:autoFilter',ns).attrib['ref'] == 'A7:I9'
print('programma-consegne.xlsx: XML valido, celle a capo e filtro corretti')
