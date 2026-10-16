import { apiRequest } from "./apiClient";
export * from "../models/Customer";
import type {Customer,CustomerData,CustomerImportRow,CustomerPreview,ImportReport} from "../models/Customer";
export const listCustomers=()=>apiRequest<Customer[]>("/customers");
export const createCustomer=(input:CustomerData)=>apiRequest<Customer>("/customers",{method:"POST",body:JSON.stringify(input)});
export const updateCustomer=(id:string,input:CustomerData,expectedUpdatedAt:string)=>apiRequest<Customer>(`/customers/${encodeURIComponent(id)}`,{method:"PUT",body:JSON.stringify({...input,expectedUpdatedAt})});
export const previewCustomers=(rows:CustomerImportRow[])=>apiRequest<CustomerPreview>("/customers/import/preview",{method:"POST",body:JSON.stringify({rows})});
export const confirmCustomers=(token:string,updateRows:number[])=>apiRequest<ImportReport>("/customers/import/confirm",{method:"POST",body:JSON.stringify({token,confirmed:true,updateRows})});
