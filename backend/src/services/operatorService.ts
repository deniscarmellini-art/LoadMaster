import type { Operator, OperatorInput } from "../models/settings.js";
import type { OperatorRepository } from "../repositories/operatorRepository.js";
import { ApiError } from "../utils/apiError.js";

export class OperatorService {
  constructor(private readonly repository: OperatorRepository) {}
  list(): Operator[] { return this.repository.list(); }
  create(input: OperatorInput): Operator { return this.repository.create(input); }
  update(id:string,input:OperatorInput):Operator { const value=this.repository.update(id,input);if(!value)throw new ApiError(404,"OPERATOR_NOT_FOUND","Operatore non trovato");return value; }
  delete(id:string):Operator { const value=this.repository.deactivate(id);if(!value)throw new ApiError(404,"OPERATOR_NOT_FOUND","Operatore non trovato");return value; }
}
