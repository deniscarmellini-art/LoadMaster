import type { Camion } from "../models/Camion";
import type { Commessa } from "../types/excel";

export interface TruckLoadingHeaderRow {
  customer: string;
  orderReference: string;
  order: string;
  truck: string;
}

const display = (value: string | undefined) => value?.trim() || "—";

export function truckLoadingHeaderRows(
  selected: Pick<Camion, "id" | "cliente" | "commessa" | "camion">,
  commesse: Commessa[],
): TruckLoadingHeaderRow[] {
  // Explicit membership can identify several orders; a shared truck name cannot.
  const linked = commesse.filter(order => order.pannelli.some(panel => panel.loadId === selected.id));
  const orders = linked.length ? linked : commesse.filter(order => order.ordine === selected.commessa);
  const rows = orders.length ? orders.map(order => ({
    customer: display(order.cliente), orderReference: display(order.riferimento),
    order: display(order.ordine), truck: display(selected.camion),
  })) : [{ customer: display(selected.cliente), orderReference: "—", order: display(selected.commessa), truck: display(selected.camion) }];
  return [...new Map(rows.map(row => [JSON.stringify(row), row])).values()];
}
