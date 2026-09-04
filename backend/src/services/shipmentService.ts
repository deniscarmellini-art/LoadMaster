import type {
  ShipmentInput,
  ShipmentRepository,
} from "../repositories/shipmentRepository.js";
import type { LoadingService } from "./loadingService.js";
import { ApiError } from "../utils/apiError.js";
export class ShipmentService {
  constructor(
    private readonly repo: ShipmentRepository,
    private readonly loading: LoadingService,
  ) {}
  list() {
    return this.repo.list();
  }
  create(input: ShipmentInput) {
    this.validate(input);
    try {
      return this.repo.create(input);
    } catch (e) {
      return this.conflict(e);
    }
  }
  update(id: string, input: ShipmentInput) {
    this.validate(input);
    try {
      const value = this.repo.update(id, input);
      if (!value)
        throw new ApiError(404, "RESOURCE_NOT_FOUND", "Spedizione non trovata");
      return value;
    } catch (e) {
      return this.conflict(e);
    }
  }
  link(id: string, loadId: string) {
    try {
      const value = this.repo.link(id, loadId);
      if (!value)
        throw new ApiError(404, "RESOURCE_NOT_FOUND", "Spedizione non trovata");
      return value;
    } catch (e) {
      return this.conflict(e);
    }
  }
  depart(id: string, input: { carrierId?: string } = {}) {
    const plan = this.repo.find(id);
    if (!plan)
      throw new ApiError(404, "RESOURCE_NOT_FOUND", "Spedizione non trovata");
    if (plan.shipmentStatus !== "PRONTA")
      throw new ApiError(409, "INVALID_STATUS", "La spedizione non è pronta");
    if (!plan.transportType)
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Tipo trasporto obbligatorio",
      );
    if (
      plan.transportType === "BILICO_ESSEPI" &&
      !input.carrierId &&
      !plan.carrierId
    )
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Trasportatore obbligatorio per la partenza del Bilico Essepi",
      );
    const now = new Date().toISOString();
    if (plan.loadId) {
      const session = this.loading
        .list()
        .find((item) => item.loadId === plan.loadId);
      if (!session)
        throw new ApiError(
          409,
          "LOADING_SESSION_NOT_FOUND",
          "Sessione di carico non trovata",
        );
      this.loading.ship(
        session.id,
        input.carrierId
          ? { carrierId: input.carrierId }
          : plan.carrierId
            ? { carrierId: plan.carrierId }
            : {},
      );
    }
    return this.repo.depart(id, now, input.carrierId)!;
  }
  delete(id: string) {
    const current = this.repo.find(id);
    if (!current)
      throw new ApiError(404, "RESOURCE_NOT_FOUND", "Spedizione non trovata");
    if (!current.persisted)
      throw new ApiError(404, "RESOURCE_NOT_FOUND", "Pianificazione non trovata");
    if(current.actualDepartureDate||current.operationalStatus==="SPEDITO"||current.shipmentStatus==="IN_VIAGGIO"||current.shipmentStatus==="CONCLUSA")
      throw new ApiError(409,"SHIPMENT_CONSOLIDATED","La spedizione non può essere eliminata perché è già partita o consolidata");
    if (!this.repo.delete(id))
      throw new ApiError(409, "RESOURCE_IN_USE", "Spedizione non eliminabile");
    return { success: true };
  }
  private validate(input: ShipmentInput) {
    if (!input.commessa?.trim() || !input.cliente?.trim())
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Commessa e cliente sono obbligatori",
      );
    if (!input.transportType)
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Tipo trasporto obbligatorio",
      );
    if (input.trailerId || input.carrierId)
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Il mezzo specifico viene assegnato successivamente dalla gestione Trasporti",
      );
  }
  private conflict(error: unknown): never {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.message === "SHIPMENT_DUPLICATE")
      throw new ApiError(
        409,
        "SHIPMENT_DUPLICATE",
        "Esiste già una spedizione per questo carico",
      );
    if (error instanceof Error && error.message === "TRAILER_NOT_AVAILABLE")
      throw new ApiError(
        409,
        "TRAILER_NOT_AVAILABLE",
        "Rimorchio non disponibile",
      );
    if (error instanceof Error && error.message === "LOAD_NOT_FOUND")
      throw new ApiError(404, "RESOURCE_NOT_FOUND", "Carico non trovato");
    throw error;
  }
}
