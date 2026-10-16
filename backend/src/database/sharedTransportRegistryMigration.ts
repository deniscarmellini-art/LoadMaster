import type { DatabaseSync } from "node:sqlite";

const key = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("it-IT");

// Keep the original combined selection as historical evidence. Reuse carrier IDs; only the explicitly confirmed Sulpizii mapping may add a missing carrier.
export function migrateSharedTransportRegistry(db: DatabaseSync): void {
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec("CREATE TABLE IF NOT EXISTS TransportRegistryMigrations(version TEXT PRIMARY KEY)");
    if (db.prepare("SELECT 1 FROM TransportRegistryMigrations WHERE version='shared-carriers-v1'").get()) {
      db.exec("COMMIT"); return;
    }
    if (!db.prepare("PRAGMA table_info(ShipmentPlans)").all().some(row => row.name === "vehicleTypeId"))
      db.exec("ALTER TABLE ShipmentPlans ADD COLUMN vehicleTypeId TEXT NULL REFERENCES ClientVehicleTypes(id)");
    const carriers = db.prepare("SELECT id,name FROM Carriers").all() as Array<{id:string;name:string}>;
    const types = db.prepare("SELECT id,name FROM ClientVehicleTypes").all() as Array<{id:string;name:string}>;
    const modes = db.prepare("SELECT * FROM ThirdPartyTransportModes").all() as Array<{id:string;name:string;active:number;sortOrder:number;createdAt:string;updatedAt:string}>;
    // Explicit business mapping confirmed by the user; do not infer other names.
    const sulpiziiModes = modes.filter(mode => ["sulpizii ferro","sulpizii alluminio"].includes(key(mode.name)));
    if (sulpiziiModes.length && !carriers.some(carrier => key(carrier.name) === "sulpizii")) {
      const source = sulpiziiModes[0]!;
      const carrier = {id:crypto.randomUUID(),name:"Sulpizii"};
      db.prepare("INSERT INTO Carriers(id,name,active,sortOrder,createdAt,updatedAt) VALUES(?,?,?,?,?,?)").run(carrier.id,carrier.name,sulpiziiModes.some(mode=>mode.active)?1:0,source.sortOrder,source.createdAt,source.updatedAt);
      carriers.push(carrier);
    }
    for (const mode of modes) {
      const name = key(mode.name);
      const matches = carriers.filter(carrier => name.startsWith(`${key(carrier.name)} `));
      if (matches.length !== 1) continue;
      const carrier = matches[0]!;
      const vehicleName = mode.name.trim().replace(/\s+/g," ").slice(carrier.name.trim().replace(/\s+/g," ").length).trim();
      const existing = types.filter(type => key(type.name) === key(vehicleName));
      if (!vehicleName || existing.length > 1) continue;
      let type = existing[0];
      if (!type) {
        type = {id:crypto.randomUUID(),name:vehicleName};
        db.prepare("INSERT INTO ClientVehicleTypes(id,name,active,sortOrder,createdAt,updatedAt) VALUES(?,?,?,?,?,?)").run(type.id,type.name,mode.active,mode.sortOrder,mode.createdAt,mode.updatedAt);
        types.push(type);
      }
      db.prepare("UPDATE ShipmentPlans SET plannedCarrierId=COALESCE(plannedCarrierId,?),vehicleTypeId=COALESCE(vehicleTypeId,?) WHERE transportMode='TERZI_PER_ESSEPI' AND transportDetailId=?").run(carrier.id,type.id,mode.id);
    }
    if (db.prepare("PRAGMA foreign_key_check").all().length) throw new Error("Shared transport registry: invalid foreign keys");
    db.exec("INSERT INTO TransportRegistryMigrations(version) VALUES('shared-carriers-v1')");
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}
