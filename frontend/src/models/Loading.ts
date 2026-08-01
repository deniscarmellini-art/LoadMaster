export type TipoUnitaCarico="SINGOLO"|"PACCO";
export type StatoCaricoOperativo="DA_CARICARE"|"IN_CARICO"|"ATTESA_SPEDIZIONE"|"SPEDITO";
export type TipoEventoCarico="AVVIO"|"SCANSIONE"|"CHIUSURA"|"RIAPERTURA"|"UNITA_AGGIUNTA"|"UNITA_RIMOSSA"|"NUOVA_CHIUSURA"|"PARTENZA";
export interface EventoCarico{tipo:TipoEventoCarico;dataOra:string;operatoreId:string;operatore:string;nota?:string;}
export interface ScansioneCarico{tipoUnita:TipoUnitaCarico;codiceUnita:string;commessa:string;camion:string;operatoreId:string;operatore:string;dataOra:string;peso:number;volume:number;esito:"OK";}
export interface CaricoCamion{commessa:string;cliente:string;camion:string;stato:StatoCaricoOperativo;rimorchioId?:string;trasportatoreId?:string;operatoreId:string;operatore:string;avviatoIl:string;completatoIl?:string;scansioni:ScansioneCarico[];eventi:EventoCarico[];}
