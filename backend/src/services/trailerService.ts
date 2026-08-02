import type { Trailer, TrailerInput } from "../models/settings.js";
import type { TrailerRepository } from "../repositories/trailerRepository.js";
import { ApiError } from "../utils/apiError.js";

export class TrailerService {
  constructor(private readonly repository: TrailerRepository) {}
  list():Trailer[]{return this.repository.list();}
  create(input:TrailerInput):Trailer{return this.repository.create(input);}
  update(id:string,input:TrailerInput):Trailer{const value=this.repository.update(id,input);if(!value)throw new ApiError(404,"RESOURCE_NOT_FOUND","Rimorchio non trovato");return value;}
  setActive(id:string,active:boolean):Trailer{const value=this.repository.setActive(id,active);if(!value)throw new ApiError(404,"RESOURCE_NOT_FOUND","Rimorchio non trovato");return value;}
  delete(id:string):Trailer{const value=this.repository.deactivate(id);if(!value)throw new ApiError(404,"RESOURCE_NOT_FOUND","Rimorchio non trovato");return value;}
}
