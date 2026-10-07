import type { Trailer, TrailerInput } from "../models/settings.js";
import type { TrailerRepository } from "../repositories/trailerRepository.js";
import { ApiError } from "../utils/apiError.js";

export class TrailerService {
  constructor(private readonly repository: TrailerRepository) {}
  list():Trailer[]{return this.repository.list();}
  create(input:TrailerInput):Trailer{return this.repository.create(input);}
  update(id:string,input:TrailerInput):Trailer{try{const value=this.repository.update(id,input);if(!value)throw new ApiError(404,"RESOURCE_NOT_FOUND","Rimorchio non trovato");return value;}catch(error){if(error instanceof Error&&error.message==="TRAILER_PLATE_IMMUTABLE")throw new ApiError(409,"TRAILER_PLATE_IMMUTABLE","La targa non puÃ² essere modificata dopo il primo utilizzo del rimorchio");throw error;}}
  setActive(id:string,active:boolean):Trailer{try{const value=this.repository.setActive(id,active);if(!value)throw new ApiError(404,"RESOURCE_NOT_FOUND","Rimorchio non trovato");return value;}catch(error){if(error instanceof Error&&error.message==="TRAILER_ARCHIVED")throw new ApiError(409,"TRAILER_ARCHIVED","Il rimorchio rottamato non può essere riattivato");throw error;}}
  delete(id:string):Trailer{try{const value=this.repository.remove(id);if(!value)throw new ApiError(404,"RESOURCE_NOT_FOUND","Rimorchio non trovato");return value;}catch(error){if(error instanceof Error&&error.message==="TRAILER_IN_USE")throw new ApiError(409,"RESOURCE_IN_USE","Il rimorchio è attualmente impegnato. Disimpegnarlo o completare il trasporto prima di rottamarlo.");throw error;}}
}
