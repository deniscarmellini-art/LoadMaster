import type { CaricoCamion } from "../models/Loading";
import { formatOptionalDate, parseOptionalDate } from "../utils/dateFormatting";

const calendarDay = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

export function historyMetricsPresentation(load: CaricoCamion) {
  const planned = parseOptionalDate(load.historyMetrics?.originalPlannedDepartureDate);
  // Never compare the plan with loading completion or another generic timestamp.
  const actual = parseOptionalDate(load.speditoIl ?? load.eventi.filter(event => event.tipo === "PARTENZA").at(-1)?.dataOra);
  const days = load.historyMetrics?.warehouseDays;
  return {
    plannedDate: planned ? formatOptionalDate(load.historyMetrics?.originalPlannedDepartureDate) : "—",
    plannedColor: planned && actual ? calendarDay(planned) === calendarDay(actual) ? "success.main" : "error.main" : undefined,
    warehouseDays: typeof days === "number" && Number.isInteger(days) && days >= 0 ? `${days} gg` : "—",
  };
}
