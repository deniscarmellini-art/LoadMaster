import type { Camion } from "../../models/Camion";

// Dashboard presentation only: never replace the operational status on the row.
export function dashboardVisualStatus(row: Camion): {
  label: string;
  color: "error" | "warning" | "info" | "success";
} {
  if (row.stato === "Attesa spedizione" || row.stato === "Partita") {
    return { label: row.stato, color: "success" };
  }
  if (row.stato === "In carico" || row.caricati > 0) {
    return { label: "In carico", color: "warning" };
  }
  if (row.previsti > 0 && row.pronti === 0) {
    return { label: "Da preparare", color: "error" };
  }
  if (row.pronti > 0 && row.pronti < row.previsti) {
    return { label: "In lavorazione", color: "warning" };
  }
  if (row.pronti === row.previsti) {
    return { label: "Da caricare", color: "info" };
  }
  return row.stato === "Da caricare"
    ? { label: row.stato, color: "info" }
    : { label: "Da preparare", color: "error" };
}
