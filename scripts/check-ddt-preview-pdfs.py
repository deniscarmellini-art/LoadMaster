"""Visual QA support: python scripts/check-ddt-preview-pdfs.py after test:ddt-preview.
Requires pymupdf; artifacts are test fixtures, never issued DDTs.
"""
from pathlib import Path
import re
import sys
import pymupdf

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / '.verification' / 'ddt'
for filename, count in [('anteprima-ddt-4-elementi.pdf', 4), ('anteprima-ddt-20-elementi.pdf', 20), ('anteprima-ddt-80-elementi.pdf', 80), ('anteprima-ddt-testi-lunghi.pdf', 80)]:
    path = root / filename
    document = pymupdf.open(path)
    expected_pages = len(document)
    assert expected_pages == 1 if count == 4 else expected_pages > 1
    all_text = ''
    for number, page in enumerate(document, 1):
        assert abs(page.rect.width - 595.28) < 1 and abs(page.rect.height - 841.89) < 1
        text = page.get_text()
        all_text += text
        labels = {label: page.search_for(label)[0] for label in ['NUMERO DDT', 'DATA DOCUMENTO', 'CLIENTE', 'PARTITA IVA', 'NUMERO COMMESSA', 'RIFERIMENTO ORDINE', 'NUMERO CAMION', 'DESTINAZIONE MERCE', 'NOTE']}
        assert abs(labels['CLIENTE'].y0-labels['PARTITA IVA'].y0) < 1
        assert abs(labels['NUMERO COMMESSA'].y0-labels['RIFERIMENTO ORDINE'].y0) < 1
        assert abs(labels['NUMERO COMMESSA'].y0-labels['NUMERO CAMION'].y0) < 1
        assert labels['NUMERO DDT'].y0 < labels['CLIENTE'].y0 < labels['NUMERO COMMESSA'].y0 < labels['DESTINAZIONE MERCE'].y0
        assert labels['NUMERO COMMESSA'].x0 < labels['RIFERIMENTO ORDINE'].x0 < labels['NUMERO CAMION'].x0
        for field, next_field, x0, x1 in [('CLIENTE','NUMERO COMMESSA',34,292.36),('PARTITA IVA','NUMERO COMMESSA',292.36,561.28),('NUMERO COMMESSA','DESTINAZIONE MERCE',34,209.76),('RIFERIMENTO ORDINE','DESTINAZIONE MERCE',209.76,385.52),('NUMERO CAMION','DESTINAZIONE MERCE',385.52,561.28)]:
            for word in page.get_text('words'):
                wx0,wy0,wx1,wy1,*_ = word
                if labels[field].y1+1 < wy0 < labels[next_field].y0-10 and x0 <= wx0 < x1:
                    assert wx1 < x1-5 and wy1 < labels[next_field].y0-10, (path,number,field,word)
        for value in ['ANTEPRIMA — NON VALIDO COME DDT', 'X-Lam/ANTEPRIMA/2026',
                      f'Pagina {number} di {expected_pages}', '100% CERTIFICATO PEFC DNVSE-PEFC-COC-401',
                      'CONTRIBUTO CONAI ASSOLTO OVE DOVUTO',
                      '4) Tutta la merce rimane di esclusiva proprietà della Essepi fino al pagamento totale della presente fattura.']:
            assert value in text, (path, number, value)
        assert '\ufffd' not in text
        for block in page.get_text('dict')['blocks']:
            if block['type'] != 0:
                continue
            for line in block['lines']:
                for span in line['spans']:
                    x0, y0, x1, y1 = span['bbox']
                    assert 0 <= x0 < x1 <= page.rect.width, (path, number, span)
                    assert 0 <= y0 < y1 <= page.rect.height, (path, number, span)
        page.get_pixmap(matrix=pymupdf.Matrix(1.25, 1.25)).save(root / f'{path.stem}-{number}.png')
    codes = re.findall(r'\bE-\d{3}\b', all_text)
    assert len(codes) == count and len(set(codes)) == count
    assert 'NOT-LOADED' not in all_text
    assert all_text.count('RIEPILOGO E DATI DI TRASPORTO') == 1
    assert '4171 × 2373' in all_text and '9,90' in all_text
    assert '9999' not in all_text
    assert 'RIF-IMPORT-DIVERSO' not in all_text
    print(f'{path.name}: {count} unique elements, {expected_pages} pages, header/footer/bounds OK')
