"""Read/render synthetic TEST fixtures; never emits operational documents."""
from pathlib import Path
import re
import sys
import pymupdf

root = Path(sys.argv[1])
for path in sorted(root.glob('definitivo-*.pdf')):
    doc = pymupdf.open(path)
    text = ''.join(page.get_text() for page in doc)
    assert 'ANTEPRIMA' not in text
    assert re.search(r'X-Lam/0001/\d{4}', text)
    expected = 80 if 'multipagina' in path.name else 4
    codes = re.findall(r'\bE-\d+\b', text)
    assert len(codes) == expected and len(set(codes)) == expected
    assert text.count('RIEPILOGO E DATI DI TRASPORTO') == 1
    for index, page in enumerate(doc):
        labels = [page.search_for(label)[0] for label in ['CLIENTE','PARTITA IVA','NUMERO COMMESSA','RIFERIMENTO ORDINE','NUMERO CAMION']]
        assert abs(labels[0].y0-labels[1].y0) < 1
        assert abs(labels[2].y0-labels[3].y0) < 1 and abs(labels[3].y0-labels[4].y0) < 1
        assert f'Pagina {index+1} di {len(doc)}' in page.get_text()
        assert 'CONTRIBUTO CONAI ASSOLTO OVE DOVUTO' in page.get_text()
        for block in page.get_text('dict')['blocks']:
            for line in block.get('lines', []):
                for span in line['spans']:
                    x0,y0,x1,y1 = span['bbox']
                    assert 0 <= x0 < x1 <= page.rect.width and 0 <= y0 < y1 <= page.rect.height, (path,index,span)
        if index in (0,len(doc)-1):
            page.get_pixmap(matrix=pymupdf.Matrix(1.25,1.25)).save(root / f'{path.stem}-{index+1}.png')
    if 'RITIRA_CLIENTE' in path.name or 'multipagina' in path.name:
        assert 'Trasporto a cura del destinatario' in text
    elif 'BILICO' in path.name:
        assert 'Trasporto a cura del mittente' in text
    else:
        assert 'Trasporto a cura del vettore' in text
    print(f'{path.name}: {expected} elementi unici, {len(doc)} pagine, numero e layout verificati')
