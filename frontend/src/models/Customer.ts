export const customerFields=[
 ["denominazione","Denominazione"],["via","Via"],["nazione","Nazione"],["cap","CAP"],["luogo","Luogo"],
 ["telefono","Telefono"],["nomeContatto","Nome Contatto"],["cellulare","Cellulare"],["email","eMail"],
 ["partitaIva","Partita IVA"],["codiceFiscale","Codice fiscale"],
] as const;
export type CustomerData=Record<typeof customerFields[number][0],string>;
export interface Customer extends CustomerData{id:string;createdAt:string;updatedAt:string}
export const emptyCustomer=():CustomerData=>Object.fromEntries(customerFields.map(([field])=>[field,""])) as CustomerData;
export interface CustomerImportRow{rowNumber:number;data:CustomerData;issues?:string[];warnings?:string[]}
export type ImportStatus="NEW"|"UPDATE"|"UNCHANGED"|"INVALID"|"AMBIGUOUS"|"POSSIBLE_DUPLICATE"|"DUPLICATE_FILE";
export interface PreviewRow extends CustomerImportRow{status:ImportStatus;message:string;customerId?:string;existing?:Customer}
export interface CustomerPreview{token:string;rows:PreviewRow[]}
export interface ImportReport{inserted:number;updated:number;unchanged:number;discarded:number;rows:Array<{rowNumber:number;status:string;message:string}>}
