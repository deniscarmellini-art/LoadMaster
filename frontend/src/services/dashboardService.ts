import type { Commessa } from "../types/excel";
import type { Camion } from "../models/Camion";
import type { CaricoCamion } from "../models/Loading";

export type OperationalLoadStatus =
  | "DA_COMPLETARE"
  | "DA_CARICARE"
  | "IN_CARICO"
  | "ATTESA_SPEDIZIONE"
  | "SPEDITO";

export type OperationalStatusColor =
  | "error"
  | "info"
  | "warning"
  | "success"
  | "default";

export const toOperationalLoadStatus = (
  status: Camion["stato"],
): OperationalLoadStatus =>
  status === "Da completare"
    ? "DA_COMPLETARE"
    : status === "Da caricare"
      ? "DA_CARICARE"
      : status === "In carico"
        ? "IN_CARICO"
        : status === "Attesa spedizione"
          ? "ATTESA_SPEDIZIONE"
          : "SPEDITO";

const operationalStatusPresentations: Record<
  OperationalLoadStatus,
  { label: string; color: OperationalStatusColor }
> = {
  DA_COMPLETARE: { label: "DA COMPLETARE", color: "error" },
  DA_CARICARE: { label: "DA CARICARE", color: "info" },
  IN_CARICO: { label: "IN CARICO", color: "warning" },
  ATTESA_SPEDIZIONE: { label: "ATTESA SPEDIZIONE", color: "success" },
  SPEDITO: { label: "SPEDITO", color: "default" },
};

export const operationalStatusPresentation = (
  status: OperationalLoadStatus,
): { label: string; color: OperationalStatusColor } =>
  operationalStatusPresentations[status];

export function creaDashboard(commesse: Commessa[]): Camion[] {

    const dashboard: Camion[] = [];

    commesse.forEach(commessa => {

        const gruppi = new Map<string, typeof commessa.pannelli>();

        commessa.pannelli.forEach(pannello => {

            const key = `${commessa.ordine}_${pannello.numeroCamion}`;

            if (!gruppi.has(key)) {
                gruppi.set(key, []);
            }

            gruppi.get(key)!.push(pannello);

        });

        gruppi.forEach((pannelli, key) => {

            const previsti = pannelli.length;

            const pronti = pannelli.filter(p => p.preparato && !p.caricato).length;

            const caricati = pannelli.filter(p => p.caricato).length;

            const mancanti = Math.max(0, previsti - pronti - caricati);

            const peso = pannelli.reduce((t, p) => t + p.peso, 0);

            const volume = pannelli.reduce((t, p) => t + p.volume, 0);

            let stato: Camion["stato"];

            const backendStatus = pannelli[0]?.loadStatus;

            if (backendStatus) {

                stato = backendStatus === "DA_COMPLETARE"
                    ? "Da completare"
                    : backendStatus === "DA_CARICARE"
                        ? "Da caricare"
                        : backendStatus === "IN_CARICO"
                            ? "In carico"
                            : backendStatus === "ATTESA_SPEDIZIONE"
                                ? "Attesa spedizione"
                                : "Partita";

            } else if (pannelli.every(p => p.spedito) && previsti > 0) {

                stato = "Partita";

            } else if (caricati === previsti && previsti > 0) {

                stato = "Attesa spedizione";

            } else if (caricati > 0) {

                stato = "In carico";

            } else if (pronti === previsti) {

                stato = "Da caricare";

            } else {

                stato = "Da completare";

            }

            dashboard.push({

                id: pannelli[0]?.loadId ?? key,

                commessa: commessa.ordine,

                cliente: commessa.cliente,

                camion: pannelli[0].numeroCamion,

                previsti,

                pronti,

                caricati,

                mancanti,

                peso,

                volume,

                stato

            });

        });

    });

    dashboard.sort((a, b) => {

        if (a.commessa === b.commessa)
            return a.camion.localeCompare(b.camion);

        return a.commessa.localeCompare(b.commessa);

    });

    return dashboard;

}

export const creaDashboardOperativa = (
  commesse: Commessa[],
  _truckLoads: CaricoCamion[],
): Camion[] => creaDashboard(commesse);
