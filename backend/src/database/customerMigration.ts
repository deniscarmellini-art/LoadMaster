import type { DatabaseSync } from "node:sqlite";

export function migrateCustomers(db:DatabaseSync):void {
 db.exec("BEGIN IMMEDIATE");
 try {
  db.exec(`CREATE TABLE IF NOT EXISTS Customers(
   id TEXT PRIMARY KEY, denominazione TEXT NOT NULL, via TEXT NOT NULL DEFAULT '',
   nazione TEXT NOT NULL DEFAULT '', cap TEXT NOT NULL DEFAULT '', luogo TEXT NOT NULL DEFAULT '',
   telefono TEXT NOT NULL DEFAULT '', nomeContatto TEXT NOT NULL DEFAULT '', cellulare TEXT NOT NULL DEFAULT '',
   email TEXT NOT NULL DEFAULT '', partitaIva TEXT NOT NULL DEFAULT '', codiceFiscale TEXT NOT NULL DEFAULT '',
   createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL)`);
  if(!db.prepare("PRAGMA table_info(ShipmentPlans)").all().some(c=>c.name==="customerId"))
   db.exec("ALTER TABLE ShipmentPlans ADD COLUMN customerId TEXT NULL REFERENCES Customers(id) ON DELETE RESTRICT");
  db.exec("CREATE INDEX IF NOT EXISTS idx_shipment_customer ON ShipmentPlans(customerId)");
  if(db.prepare("PRAGMA foreign_key_check").all().length)throw new Error("Customer migration: invalid foreign keys");
  db.exec("COMMIT");
 } catch(error){db.exec("ROLLBACK");throw error;}
}
