import type { Camion } from "../../models/Camion";
import type { Commessa } from "../../types/excel";
import { truckLoadingHeaderRows } from "../../services/truckLoadingHeader";
import { OperationalIdentity } from "../shared/OperationalLayout";

export default function TruckLoadingHeader({ selected, commesse }: { selected: Camion; commesse: Commessa[] }) {
  return <OperationalIdentity fullWidth rows={truckLoadingHeaderRows(selected,commesse)} label="Dati del carico selezionato"/>;
}
