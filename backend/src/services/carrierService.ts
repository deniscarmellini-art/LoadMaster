import type { Carrier, CarrierInput } from "../models/settings.js";
import type { CarrierRepository } from "../repositories/carrierRepository.js";
import { ApiError } from "../utils/apiError.js";

export class CarrierService {
  constructor(private readonly repository: CarrierRepository) {}
  list():Carrier[]{return this.repository.list();}
  create(input:CarrierInput):Carrier{return this.repository.create(input);}
  update(id:string,input:CarrierInput):Carrier{const value=this.repository.update(id,input);if(!value)throw new ApiError(404,"RESOURCE_NOT_FOUND","Trasportatore non trovato");return value;}
  setActive(id:string,active:boolean):Carrier{const value=this.repository.setActive(id,active);if(!value)throw new ApiError(404,"RESOURCE_NOT_FOUND","Trasportatore non trovato");return value;}
  delete(id:string):Carrier{const value=this.repository.deactivate(id);if(!value)throw new ApiError(404,"RESOURCE_NOT_FOUND","Trasportatore non trovato");return value;}
}
