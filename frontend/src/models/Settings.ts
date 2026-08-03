export interface Operatore { id:string; nome:string; cognome:string; sigla:string; attivo:boolean; }
export interface Rimorchio { id:string;targa:string;descrizione:string;attivo:boolean;note:string;prossimaRevisione?:string; }
export interface Trasportatore { id:string; nome:string; attivo:boolean; note:string; }
export interface ImpostazioneOperativa { chiave:string; valore:string; descrizione:string; attivo:boolean; }
export interface SettingsData { operatori:Operatore[]; rimorchi:Rimorchio[]; trasportatori:Trasportatore[]; listeOperative:ImpostazioneOperativa[]; }
export const operatorLabel=(operator:Operatore)=>`${operator.sigla?`${operator.sigla} — `:""}${operator.nome} ${operator.cognome}`.trim();
