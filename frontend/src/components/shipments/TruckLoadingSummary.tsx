import CompactOperationalSummary from "../shared/CompactOperationalSummary";
import { truckLoadingHeaderRows } from "../../services/truckLoadingHeader";
import type { Camion } from "../../models/Camion";
import type { Commessa } from "../../types/excel";

export default function TruckLoadingSummary({selected,commesse,kpis}:{selected:Camion;commesse:Commessa[];kpis:Array<[string,string|number]>}) {
  const rows=truckLoadingHeaderRows(selected,commesse);
  const values=(key:keyof typeof rows[number])=>rows.map(row=>row[key]).join("\n");
  return <CompactOperationalSummary label="Riepilogo compatto carico camion" fields={[["Cliente",values("customer")],["Commessa",values("order")],["Riferimento ordine",values("orderReference")],["Camion",values("truck")],...kpis.slice(0,4)]}/>;
}
