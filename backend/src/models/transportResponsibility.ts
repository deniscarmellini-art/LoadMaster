export const transportResponsibilityByMode = {
  BILICO_ESSEPI: {subject:"MITTENTE",label:"Trasporto a cura del mittente"},
  RITIRA_CLIENTE: {subject:"DESTINATARIO",label:"Trasporto a cura del destinatario"},
  TERZI_PER_ESSEPI: {subject:"VETTORE",label:"Trasporto a cura del vettore"},
} as const;
