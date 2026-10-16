import type { DatabaseSync } from "node:sqlite";

export function migrateShipmentDeliveryAddress(database: DatabaseSync): void {
  const columns = database.prepare("PRAGMA table_info(ShipmentPlans)").all() as Array<{name: string}>;
  if (columns.some(column => column.name === "deliveryAddress")) return;
  database.exec("BEGIN IMMEDIATE");
  try {
    // No inferred address: customer names and order references are separate data.
    database.exec("ALTER TABLE ShipmentPlans ADD COLUMN deliveryAddress TEXT NULL");
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
