import type { DatabaseSync } from "node:sqlite";

// SQLite cannot remove a CHECK in place. Rebuild only its definition, preserving
// every column, row, index and trigger. Required details are validated at completion.
export function migrateLoadingTransport(database:DatabaseSync):void {
  const definition=database.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='LoadingSessions'").get() as {sql:string};
  const oldCheck=/,\s*CHECK\s*\(\(destinationType='RIMORCHIO_ESSEPI' AND trailerId IS NOT NULL\) OR \(destinationType='TRASPORTATORE' AND carrierId IS NOT NULL\)\)/;
  if(oldCheck.test(definition.sql)){
    const indexes=database.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='LoadingSessions' AND sql IS NOT NULL").all() as Array<{sql:string}>;
    const triggers=database.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger'").all() as Array<{name:string;sql:string}>;
    const quote=(name:string)=>`"${name.replaceAll('"','""')}"`;
    const columns=(database.prepare("PRAGMA table_info(LoadingSessions)").all() as Array<{name:string}>).map(c=>quote(c.name)).join(",");
    database.exec("PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE");
    try{
      for(const trigger of triggers)database.exec(`DROP TRIGGER ${quote(trigger.name)}`);
      database.exec(definition.sql.replace(oldCheck,"").replace(/CREATE TABLE\s+"?LoadingSessions"?/i,"CREATE TABLE LoadingSessionsTransportMigration"));
      database.exec(`INSERT INTO LoadingSessionsTransportMigration(${columns}) SELECT ${columns} FROM LoadingSessions`);
      database.exec("DROP TABLE LoadingSessions; ALTER TABLE LoadingSessionsTransportMigration RENAME TO LoadingSessions");
      for(const index of indexes)database.exec(index.sql);
      for(const trigger of triggers)database.exec(trigger.sql);
      if(database.prepare("PRAGMA foreign_key_check").all().length)throw new Error("Loading transport migration: invalid foreign keys");
      database.exec("COMMIT");
    }catch(error){database.exec("ROLLBACK");throw error;}
    finally{database.exec("PRAGMA foreign_keys=ON");}
  }
  const columns=new Set((database.prepare("PRAGMA table_info(LoadingSessions)").all() as Array<{name:string}>).map(column=>column.name));
  for(const name of ["transportMode","transportDetailId","transportDetailLabel"]){
    if(!columns.has(name))database.exec(`ALTER TABLE LoadingSessions ADD COLUMN ${name} TEXT NULL`);
  }
}
