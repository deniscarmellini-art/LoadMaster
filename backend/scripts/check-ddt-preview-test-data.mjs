// Inspect the explicit TEST database through a read-only connection; never starts migrations.
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { ddtPreview } from '../dist/repositories/ddtPreviewRepository.js';
import { renderDdtPreview } from '../dist/services/ddtPreviewPdf.js';
const db=new DatabaseSync(fileURLToPath(new URL('../data/sistema-logistico-test.sqlite',import.meta.url)),{readOnly:true});
const output=fileURLToPath(new URL('../../.verification/ddt/test-data/',import.meta.url));
mkdirSync(output,{recursive:true});
const results=[];
try {
  for(const {id} of db.prepare('SELECT id FROM LoadingSessions ORDER BY id').all()) {
    try {
      const model=ddtPreview(db,id,new Date(),true);const result=renderDdtPreview(model);
      writeFileSync(`${output}/${id}.pdf`,result.pdf);
      results.push({id,status:'PDF_GENERATED',elements:model.totals.elements,pages:result.pages});
    } catch(error) {results.push({id,status:'BLOCKED',reason:error.message});}
  }
}finally{db.close();}
writeFileSync(`${output}/report.json`,JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
