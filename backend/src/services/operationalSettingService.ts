import type { OperationalSetting, OperationalSettingInput } from "../models/settings.js";
import type { OperationalSettingRepository } from "../repositories/operationalSettingRepository.js";
import { ApiError } from "../utils/apiError.js";

export class OperationalSettingService{
  constructor(private readonly repository:OperationalSettingRepository){}
  list():OperationalSetting[]{return this.repository.list();}
  create(input:OperationalSettingInput):OperationalSetting{return this.repository.create(input);}
  update(key:string,input:OperationalSettingInput):OperationalSetting{const value=this.repository.update(key,input);if(!value)throw new ApiError(404,"RESOURCE_NOT_FOUND","Valore operativo non trovato");return value;}
  setActive(key:string,active:boolean):OperationalSetting{const value=this.repository.setActive(key,active);if(!value)throw new ApiError(404,"RESOURCE_NOT_FOUND","Valore operativo non trovato");return value;}
  delete(key:string):OperationalSetting{const value=this.repository.deactivate(key);if(!value)throw new ApiError(404,"RESOURCE_NOT_FOUND","Valore operativo non trovato");return value;}
}
