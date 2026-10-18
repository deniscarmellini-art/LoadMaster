import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync, realpathSync, statSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { testDatabase, assertTestDatabase } from '../backend/src/config/testEnvironment.ts';
import { migrateDefinitiveDdt } from '../backend/src/database/definitiveDdtMigration.ts';
import { migrateDdtLocks } from '../backend/src/database/ddtLocksMigration.ts';

assertTestDatabase();
if (!statSync(testDatabase).isFile()) throw new Error('Database TEST assente');
const path=realpathSync(testDatabase);
const backupDirectory=join(dirname(path),'backups');mkdirSync(backupDirectory,{recursive:true});
const target=join(backupDirectory,`pre-ddt-2b-${new Date().toISOString().replaceAll(':','-')}-${crypto.randomUUID()}.sqlite`);
const source=new DatabaseSync(path,{readOnly:true});
try{await backup(source,target);}finally{source.close();}
const copy=new DatabaseSync(target,{readOnly:true});
try{if(copy.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('Backup non integro');}finally{copy.close();}
console.log(JSON.stringify({database:path,backup:target,sha256:createHash('sha256').update(readFileSync(target)).digest('hex')}));
if(process.argv.includes('--backup-only'))process.exit(0);
assertTestDatabase(path);
const db=new DatabaseSync(path);db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');
try{
  const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT IN ('DdtDocuments','DdtSequences') AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  const fingerprint=()=>createHash('sha256').update(JSON.stringify(tables.map(({name})=>[name,db.prepare(`SELECT * FROM "${String(name).replaceAll('"','""')}" ORDER BY rowid`).all()]))).digest('hex');
  const before=fingerprint();migrateDefinitiveDdt(db);migrateDdtLocks(db);
  if(before!==fingerprint())throw new Error('Dati operativi modificati durante migration');
  console.log(JSON.stringify({activated:true,operationalDataUnchanged:true,documents:db.prepare('SELECT COUNT(*) n FROM DdtDocuments').get().n}));
}finally{db.close();}
