import type { Commessa } from "../types/excel";
import type { Camion } from "../models/Camion";

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

            const pronti = pannelli.filter(p => p.preparato).length;

            const caricati = pannelli.filter(p => p.caricato).length;

            const mancanti = previsti - pronti;

            const peso = pannelli.reduce((t, p) => t + p.peso, 0);

            const volume = pannelli.reduce((t, p) => t + p.volume, 0);

            let stato: Camion["stato"];

            if (caricati === previsti && previsti > 0) {

                stato = "Attesa spedizione";

            } else if (caricati > 0) {

                stato = "In carico";

            } else if (pronti === previsti) {

                stato = "Da caricare";

            } else {

                stato = "Da completare";

            }

            dashboard.push({

                id: key,

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
