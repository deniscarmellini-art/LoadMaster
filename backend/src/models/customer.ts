export const customerFields=["denominazione","via","nazione","cap","luogo","telefono","nomeContatto","cellulare","email","partitaIva","codiceFiscale"] as const;
export type CustomerData=Record<typeof customerFields[number],string>;
export interface CustomerRecord extends CustomerData{id:string;createdAt:string;updatedAt:string}
export interface CustomerImportRow{rowNumber:number;data:CustomerData;issues?:string[];warnings?:string[]}
export type CustomerImportStatus="NEW"|"UPDATE"|"UNCHANGED"|"INVALID"|"AMBIGUOUS"|"POSSIBLE_DUPLICATE"|"DUPLICATE_FILE";
export interface CustomerPreviewRow extends CustomerImportRow{status:CustomerImportStatus;customerId?:string;existing?:CustomerRecord;message:string}
