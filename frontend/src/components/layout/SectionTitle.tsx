import type { PrimaryNavigationPage } from "../navigation/PrimaryNavigation";

const sectionTitles: Record<PrimaryNavigationPage, string> = {
  dashboard: "Sistema Logistico",
  import: "Importa",
  labels: "Etichette",
  "scanning-list": "Scansione",
  warehouse: "Magazzino",
  loading: "Carico camion",
  transports: "Trasporti",
  shipments: "Spedizioni",
  history: "Storico",
  settings: "Impostazioni",
};

export const sectionTitleFor = (page: PrimaryNavigationPage): string => sectionTitles[page];
