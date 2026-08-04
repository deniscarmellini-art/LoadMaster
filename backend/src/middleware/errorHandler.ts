import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { ErrorResponse } from "../models/api.js";
import { ApiError } from "../utils/apiError.js";

const response = (code: string, message: string): ErrorResponse => ({
  success: false,
  error: { code, message },
});

export const registerNotFoundHandler = (app:FastifyInstance,spaFallback=false):void=>{
  app.setNotFoundHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    if(spaFallback&&request.method==="GET"&&!request.url.startsWith("/api/")&&request.url!=="/api"){
      await reply.type("text/html; charset=utf-8").sendFile("index.html");
      return;
    }
    await reply.status(404).send(response("RESOURCE_NOT_FOUND", "Risorsa non trovata"));
  });
};

export const registerErrorHandlers = (app: FastifyInstance): void => {
  app.setErrorHandler(async (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof ApiError) {
      await reply.status(error.statusCode).send(response(error.code, error.message));
      return;
    }

    if (error.validation) {
      await reply.status(400).send(response("VALIDATION_ERROR", "Dati della richiesta non validi"));
      return;
    }

    if ("code" in error && typeof error.code === "string" && error.code.startsWith("SQLITE_CONSTRAINT")) {
      await reply.status(409).send(response("DUPLICATE_RESOURCE", "Esiste già un record con gli stessi dati identificativi"));
      return;
    }

    request.log.error({ error }, "Errore non gestito");
    await reply.status(500).send(response("INTERNAL_SERVER_ERROR", "Errore interno del server"));
  });
};
