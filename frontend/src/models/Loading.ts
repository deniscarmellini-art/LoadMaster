export type TipoUnitaCarico="SINGOLO"|"PACCO";
export type TipoDestinazioneCarico="RIMORCHIO_ESSEPI"|"TRASPORTATORE";
export type StatoCaricoOperativo="DA_COMPLETARE"|"DA_CARICARE"|"IN_CARICO"|"ATTESA_SPEDIZIONE"|"SPEDITO";
export type TipoEventoCarico="AVVIO"|"SCANSIONE"|"CHIUSURA"|"RIAPERTURA"|"UNITA_AGGIUNTA"|"UNITA_RIMOSSA"|"NUOVA_CHIUSURA"|"PARTENZA";
export interface EventoCarico{tipo:TipoEventoCarico;dataOra:string;operatoreId:string;operatore:string;nota?:string;}
export interface ScansioneCarico{tipoUnita:TipoUnitaCarico;codiceUnita:string;commessa:string;camion:string;operatoreId:string;operatore:string;dataOra:string;peso:number;volume:number;esito:"OK";}
export interface CaricoCamion{loadId:string;commessa:string;cliente:string;camion:string;stato:StatoCaricoOperativo;tipoDestinazione?:TipoDestinazioneCarico;rimorchioId?:string;trasportatoreId?:string;operatoreId:string;operatore:string;avviatoIl:string;completatoIl?:string;speditoIl?:string;scansioni:ScansioneCarico[];eventi:EventoCarico[];}
