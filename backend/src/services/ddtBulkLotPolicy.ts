import { ApiError } from "../utils/apiError.js";

/** Explicit correction for one verified physical lot; never infer bulk from its name. */
export const SFRIDO_BULK_LOT_POLICY = Object.freeze({
  id: "SFRIDO_BULK_LOT_265852_PK240_V1",
  panelId: "04a5c37a-a3f5-4fbf-975e-f14b2d1cc0e5",
  loadId: "bdb815b9-8438-4b52-a7a3-bfb83ba96fab",
  packageId: "061d5710-464e-402c-9c14-6563da944eaa",
  packageCode: "PK-2026-000240", order: "265852", truck: "C1-",
  panelNumber: "SFRIDO", material: "SFRIDO XLAM",
});

export interface BulkLotContext { loadId: unknown; order: unknown; truck: unknown; packageCode: string | undefined }
export interface DdtBulkLotElement {
  kind: "BULK_LOT"; classificationId: string; id: string; number: string; quantity: 1;
  type: string; length: null; width: null; area: null; weight: null;
}

export function classifyVerifiedBulkLot(row: Record<string, unknown>, context: BulkLotContext): DdtBulkLotElement | null {
  const p = SFRIDO_BULK_LOT_POLICY;
  if (row.id !== p.panelId) return null;
  const fail = (message: string): never => { throw new ApiError(422, "DDT_PREVIEW_DATA_MISSING", message); };
  if (row.loadId !== p.loadId || row.packageId !== p.packageId || context.loadId !== p.loadId ||
      context.order !== p.order || context.truck !== p.truck || context.packageCode !== p.packageCode ||
      row.numeroPannello !== p.panelNumber || row.tipoPannello !== p.material)
    fail("Lotto sfuso SFRIDO: identificazione non coerente con la rettifica autorizzata.");
  if (row.quantita !== 1) fail("Lotto sfuso SFRIDO: occorre la rettifica autorizzata della quantità a 1 lotto.");
  if (["spessore", "lunghezza", "altezza", "superficie", "peso", "volume"].some(field => row[field] !== 0))
    fail("Lotto sfuso SFRIDO: dati diversi da quelli verificati; riesaminare la classificazione.");
  return { kind: "BULK_LOT", classificationId: p.id, id: p.panelId, number: p.panelNumber, quantity: 1,
    type: "SFRIDO XLAM - merce sfusa", length: null, width: null, area: null, weight: null };
}
