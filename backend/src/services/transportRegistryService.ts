import type { TransportRegistryEntry,TransportRegistryInput } from "../models/settings.js";
import type { TransportRegistryRepository } from "../repositories/transportRegistryRepository.js";
import { ApiError } from "../utils/apiError.js";

export class TransportRegistryService{
 constructor(private readonly repository:TransportRegistryRepository,private readonly label:string){}
 list():TransportRegistryEntry[]{return this.repository.list();}
 create(input:TransportRegistryInput):TransportRegistryEntry{return this.repository.create(input);}
 update(id:string,input:TransportRegistryInput):TransportRegistryEntry{const value=this.repository.update(id,input);if(!value)throw new ApiError(404,"RESOURCE_NOT_FOUND",`${this.label} non trovato`);return value;}
 setActive(id:string,active:boolean):TransportRegistryEntry{const value=this.repository.setActive(id,active);if(!value)throw new ApiError(404,"RESOURCE_NOT_FOUND",`${this.label} non trovato`);return value;}
 delete(id:string):TransportRegistryEntry{const value=this.repository.deactivate(id);if(!value)throw new ApiError(404,"RESOURCE_NOT_FOUND",`${this.label} non trovato`);return value;}
}
