import CompactOperationalSummary from "../shared/CompactOperationalSummary";
import { panelScanningSummaryFields, type PanelScanningSummaryData } from "../../services/panelScanningSummary";

export default function PanelScanningSummary(props: PanelScanningSummaryData) {
    const fields=panelScanningSummaryFields(props);
    const ordered=[fields[0]!,fields[2]!,fields[1]!,fields[3]!,...fields.slice(4)];
    return <CompactOperationalSummary fields={ordered} label="Riepilogo scansione elemento finito"/>;
}
