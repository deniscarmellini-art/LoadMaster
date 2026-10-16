import type { TransportRegistryEntry,TransportRegistryInput } from "../models/settings.js";
import type { TransportRegistryRepository } from "../repositories/transportRegistryRepository.js";
import { ApiError } from "../utils/apiError.js";

export class TransportRegistryService{
 constructor(private readonly repository:TransportRegistryRepository,private readonly label:string){}
 list():TransportRegistryEntry[]{return this.repository.list();}
 create(input:TransportRegistryInput):TransportRegistryEntry{try{return this.repository.create(input);}catch(error){return this.validationError(error);}}
 update(id:string,input:TransportRegistryInput):TransportRegistryEntry{try{const value=this.repository.update(id,input);if(!value)throw new ApiError(404,"RESOURCE_NOT_FOUND",`${this.label} non trovato`);return value;}catch(error){return this.validationError(error);}}
 setActive(id:string,active:boolean):TransportRegistryEntry{const value=this.repository.setActive(id,active);if(!value)throw new ApiError(404,"RESOURCE_NOT_FOUND",`${this.label} non trovato`);return value;}
 delete(id:string):TransportRegistryEntry{const value=this.repository.deactivate(id);if(!value)throw new ApiError(404,"RESOURCE_NOT_FOUND",`${this.label} non trovato`);return value;}
 private validationError(error:unknown):never {
  if(error instanceof Error&&error.message==="DUPLICATE_VEHICLE_TYPE")throw new ApiError(409,"DUPLICATE_VEHICLE_TYPE","Tipo di mezzo già presente, anche se disattivato");
  if(error instanceof Error&&error.message==="EMPTY_VEHICLE_TYPE")throw new ApiError(400,"VALIDATION_ERROR","Il nome del tipo di mezzo è obbligatorio");
  throw error;
 }
}
