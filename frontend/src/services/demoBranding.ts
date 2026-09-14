export const isDemoEnvironment = import.meta.env.VITE_SISLOG_DEMO === true;

export const demoBranding = {
  application: isDemoEnvironment ? "SisLog DEMO" : "Sistema Logistico",
  company: isDemoEnvironment ? "PMI Software" : "ESSEPI S.r.l.",
  bilico: isDemoEnvironment ? "Bilico aziendale" : "Bilico Essepi",
  rimorchio: isDemoEnvironment ? "Rimorchio aziendale" : "Rimorchio Essepi",
  caricoRimorchio: isDemoEnvironment ? "Carico su rimorchio aziendale" : "Carico su rimorchio Essepi",
};
